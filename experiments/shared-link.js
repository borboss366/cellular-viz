// The shared source's link (docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md, task 2): the BroadcastChannel 'cellular-viz-clock'
// and the beat relay's socket (/relay?v=1 in conduct-serve, qa/beat-relay.mjs) behind one object that looks like the
// channel ({ onmessage, postMessage, close }), so clock.js's shared source and Clock.publish use it in place of the
// channel. A page in Chrome hears both (whichever speaks first counts, the copy is dropped); a page in OBS's browser,
// where the channel does not reach, hears the socket. The messages and the authority are the same as on the channel.
//
// What arrives (channel or socket) passes these filters (experiments/relay-lib.js; VIZ research notes 2 and 3):
//   - the relay's own messages (hello, relay-error) stay here; { type: 'time' } feeds the clock offset estimate
//   - a socket message whose seq is not newer than the last of its type is old (a late state already seen)
//   - a late clock (the relay's stored state) older than 2 s by its own t is dropped: the page free-runs, no jump
//   - clock and knobs: a copy with the same or an older t is dropped (the other path's copy)
//   - commands (panic, slot, jump) with an id apply once (onceFilter)
// What a page posts goes to the channel and the socket; a command without an id gets one first (idMaker), so a
// receiver that hears both applies it once.
// The socket: opened when relayWanted(search, cookie) (?relay=0: never; ?relay=1 or ?relay=ws://...: always; else when
// conduct-serve served the page, its cookie cvrelay=1). Lost: the channel goes on alone, the shared source free-runs
// as today after 2 s without messages, and the socket reconnects quietly (RelayLib.backoffMs: 250 ms doubling to 8 s,
// with jitter). On open the relay sends its hello and the latest state. A page that becomes visible again (OBS
// throttles hidden sources) sends { type: 'resync' } and takes the fresh state instead of extrapolating the gap.
// The clock offset to the relay (min round trip of 5 pings at open and every 30 s) is measured and logged
// (state.offset, offsetLog), report only: the clock's time base stays wall time, as the brief says.
//   SharedLink.create({ channel, BroadcastChannel, WebSocket, url, search, cookie, location, document, now, setTimeout,
//     clearTimeout, random, name }) -> { onmessage, postMessage(msg), close(), receive(msg, from), resync(), state,
//     offsetLog }
//   SharedLink.relayWanted(search, cookie), SharedLink.relayUrl(location, search)
// Loaded by clock.js next to itself (with relay-lib.js) when the page wants the relay; node's tests require it.
(function (root) {
  'use strict';
  const Lib = root.RelayLib || (typeof module === 'object' && module.exports && typeof require === 'function' ? require('./relay-lib.js') : null);
  const CHANNEL = 'cellular-viz-clock';
  const MONO_TYPES = ['clock', 'knobs'];
  const OFFSET_ASK_MS = 100, OFFSET_IDLE_MS = 1000, OFFSET_LOG_KEPT = 32;
  const epochNow = () => (root.performance ? (root.performance.timeOrigin || 0) + root.performance.now() : Date.now());

  function param(search, name) {
    const m = new RegExp('[?&]' + name + '=([^&#]*)').exec(String(search || ''));
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return null; }
  }
  function relayWanted(search, cookie) {
    const v = param(search, 'relay');
    if (v === '0') return false;
    if (v === '1' || (v && /^wss?:\/\//.test(v))) return true;
    return /(?:^|;\s*)cvrelay=1(?:;|$)/.test(String(cookie || ''));
  }
  function relayUrl(loc, search) {
    const v = param(search, 'relay');
    if (v && /^wss?:\/\//.test(v)) return v;
    if (!loc || !loc.host || !/^https?:$/.test(loc.protocol || '')) return null;
    return (loc.protocol === 'https:' ? 'wss' : 'ws') + '://' + loc.host + Lib.RELAY_PATH + '?v=' + Lib.RELAY_VERSION;
  }

  function create(opts) {
    const o = opts || {};
    const now = o.now || epochNow;
    const setT = o.setTimeout || ((f, ms) => setTimeout(f, ms)), clearT = o.clearTimeout || (id => clearTimeout(id));
    const WS = 'WebSocket' in o ? o.WebSocket : root.WebSocket;
    const BC = 'BroadcastChannel' in o ? o.BroadcastChannel : root.BroadcastChannel;
    const loc = 'location' in o ? o.location : root.location;
    let search = o.search, cookie = o.cookie;
    try { if (search === undefined) search = loc ? loc.search : ''; } catch (e) { search = ''; }
    try { if (cookie === undefined) cookie = root.document ? root.document.cookie : ''; } catch (e) { cookie = ''; }
    const once = Lib.onceFilter(), seq = Lib.seqGate(), tracker = Lib.offsetTracker();
    const ids = Lib.idMaker(o.idBase || ('p' + Math.floor(now()).toString(36) + Math.floor((o.random || Math.random)() * 1e6).toString(36)));
    const lastT = {};
    const st = { socket: 'off', url: null, opens: 0, attempts: 0, nextMs: null, fromChannel: 0, fromSocket: 0, sent: 0,
      dropped: { old: 0, stale: 0, copy: 0, repeat: 0 }, resyncs: 0, offset: null, hello: null };
    let ch = null, ws = null, retry = 0, closed = false, retryTimer = null, offsetTimer = null, rounds = 0;

    const link = { onmessage: null, state: st, offsetLog: [], postMessage, close, receive, resync };

    function deliver(msg, from) {
      if (!msg || typeof msg !== 'object' || closed) return;
      if (msg.type === 'hello') { st.hello = { ok: !!msg.ok, clients: msg.clients, error: msg.error || null }; return; }
      if (msg.type === 'relay-error') return;
      if (msg.type === 'time') {
        const est = tracker.onTime(msg, now());
        if (est && tracker.rounds !== rounds) {
          rounds = tracker.rounds;
          st.offset = { ms: +est.offset.toFixed(2), rttMs: +est.rtt.toFixed(2), n: est.n };
          link.offsetLog.push({ at: now(), ...st.offset });
          if (link.offsetLog.length > OFFSET_LOG_KEPT) link.offsetLog.shift();
        }
        return;
      }
      if (from === 'socket' && !seq.fresh(msg)) { st.dropped.old++; return; }
      if (msg.type === 'clock' && msg.late && !Lib.lateClockUsable(msg, now())) { st.dropped.stale++; return; }
      if (MONO_TYPES.indexOf(msg.type) >= 0 && Number.isFinite(msg.t)) {
        if (Number.isFinite(lastT[msg.type]) && msg.t <= lastT[msg.type]) { st.dropped.copy++; return; }
        lastT[msg.type] = msg.t;
      }
      if (!once.first(msg)) { st.dropped.repeat++; return; }
      if (from === 'socket') st.fromSocket++; else st.fromChannel++;
      if (typeof link.onmessage === 'function') link.onmessage({ data: msg });
    }
    function receive(msg, from) { deliver(msg, from === 'socket' ? 'socket' : 'channel'); }

    function postMessage(msg) {
      if (!msg || typeof msg !== 'object' || closed) return;
      let m = msg;
      if (Lib.COMMAND_TYPES.indexOf(m.type) >= 0 && (m.id === undefined || m.id === null)) m = Object.assign({}, m, { id: ids() });
      if (ch) { try { ch.postMessage(m); } catch (e) { /* closed */ } }
      if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); st.sent++; } catch (e) { /* closing */ } }
    }
    function sendSocket(m) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); return true; } catch (e) { return false; } } return false; }
    function resync() { if (sendSocket({ type: 'resync', v: Lib.RELAY_VERSION })) st.resyncs++; }

    function pumpOffset() {
      offsetTimer = null;
      if (closed || !ws || ws.readyState !== 1) return;
      const a = tracker.ask(now());
      if (a) sendSocket(a);
      offsetTimer = setT(pumpOffset, a ? OFFSET_ASK_MS : OFFSET_IDLE_MS);
    }
    function later() {
      if (closed || retryTimer) return;
      const ms = Lib.backoffMs(retry++, o.random);
      st.attempts++; st.nextMs = ms; st.socket = 'waiting';
      retryTimer = setT(() => { retryTimer = null; connect(); }, ms);
    }
    function connect() {
      if (closed || !st.url || typeof WS !== 'function') return;
      st.socket = 'connecting';
      let s;
      try { s = new WS(st.url); } catch (e) { later(); return; }
      ws = s;
      s.onopen = () => { if (ws !== s) return; st.socket = 'open'; st.opens++; retry = 0; st.nextMs = null; pumpOffset(); };
      s.onmessage = e => {
        if (ws !== s) return;
        let m = null;
        try { m = JSON.parse(e && e.data); } catch (err) { m = null; }
        if (m) deliver(m, 'socket');
      };
      s.onclose = () => { if (ws !== s) return; ws = null; st.socket = 'closed'; if (offsetTimer) { clearT(offsetTimer); offsetTimer = null; } later(); };
      s.onerror = () => { /* onclose follows */ };
    }
    function close() {
      closed = true;
      if (retryTimer) { clearT(retryTimer); retryTimer = null; }
      if (offsetTimer) { clearT(offsetTimer); offsetTimer = null; }
      if (ws) { const s = ws; ws = null; try { s.close(); } catch (e) { /* closed */ } }
      if (ch) { try { ch.close(); } catch (e) { /* closed */ } ch = null; }
      st.socket = 'off';
    }

    // the channel: the one given (clock.js hands over the one it already listens on), else a new one
    if (o.channel) ch = o.channel;
    else if (typeof BC === 'function') { try { ch = new BC(o.name || CHANNEL); } catch (e) { ch = null; } }
    if (ch) ch.onmessage = e => deliver(e && e.data, 'channel');
    // the socket
    st.url = o.url !== undefined ? o.url : (relayWanted(search, cookie) ? relayUrl(loc, search) : null);
    if (st.url) connect();
    // visible again: take the fresh state from the relay
    const doc = 'document' in o ? o.document : root.document;
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') resync(); });
    }
    return link;
  }

  const api = { CHANNEL, MONO_TYPES, create, relayWanted, relayUrl };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SharedLink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
