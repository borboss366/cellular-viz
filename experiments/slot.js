// The slot windows (the user, 19 Nov 23:01: "start with two windows"; owner brief amendment 3, without the relay:
// the show runs in Chrome windows, where the BroadcastChannel reaches every window). slot.html?slot=A|B shows ONE scene
// of set.json at full window in an iframe (the scene's own URL: set.json's defaults, then the scene's query, then
// in=<label>; so capture=1 and the knob links stay) and steps through the set on a command:
//   - { type: 'slot', v: 1, slot: 'A' | 'B', dir: -1 | 1 } on the shared clock's channel (the conductor's
//     Clock.publish slot(); the controller's upper buttons 3/4 = slot A previous/next, 7/8 = slot B)
//   - the left / right arrow keys (or Page Up / Page Down) in the slot window, also while the scene has the focus;
//     no scene in the set uses them (checked 19 Nov)
// On a switch a black cover goes up at once, the old scene's frame is removed (its WebGL context lost first, so many
// switches do not pile contexts up), the new one loads, and the cover comes down when the scene's shared clock reports
// "locked" (__qa.sharedClock, audio-in) or after READY_MS at the latest. The panic state is kept: a scene loaded during
// a blackout or calm gets it at once (its __panic.set), and a blackout keeps the cover black.
// The iframe has allow="autoplay; microphone": the scene's AudioContext (its clock) may start without a key press when
// Chrome runs with --autoplay-policy=no-user-gesture-required (the runbook's start command).
// The knobs per slot (the user, 20 Nov 15:34: "lock the knobs per slot and the scene decides what to do with them"):
// set.json numbers every *Knob param (beatKnob, diveKnob, pulseKnob, ...) 1-4, the slot's own four knobs. Slot A uses
// them as written (the controller's top-row knobs 1-4, above fader 1); slot B adds 4 (knobs 5-8, above fader 5).
// "Open all scenes" and a scene opened alone use the numbers as written. On every switch (and when the conductor asks
// with { type: 'controls-ask', v: 1 }) the slot sends { type: 'controls', v: 1, slot, scene, controls: [{ knob, name }] }
// on the channel: the scene's knobs, named after the param (beatKnob -> beat), for the conductor's line and LEDs.
//   SlotLib.parseSlot(search) -> 'A' | 'B' (default 'A'); startIndex(slot, search, n) -> A: 0, B: 1, ?scene=N (1-based)
//   SlotLib.step(i, dir, n), slotCommand(msg, slot) -> -1 | 1 | 0, keyDir(e) -> -1 | 1 | 0
//   SlotLib.slotKnobs(set, scene, slot) -> { [param]: 'N' } (the *Knob params, slot B + 4); controls(set, scene, slot)
//     -> [{ knob, name }] by knob
//   SlotLib.create({ doc, win, set, slot, start, inLabel, channel, now, setTimeout, clearTimeout, setInterval, clearInterval })
//     -> { show(i), step(dir), onMessage(msg), onKey(e), qa, stop() }
// Include after set.js (SetLib). Node's tests require it with SetLib passed in.
(function (root) {
  'use strict';
  const SLOT_NAMES = ['A', 'B'];
  const READY_MS = 2500, POLL_MS = 50, SWITCHES_KEPT = 64;
  const KEYS = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1 };
  // the knobs per slot (see the header): a *Knob param, the slot's four knobs, and where each slot's knobs start
  const KNOB_PARAM = /^([a-z][A-Za-z0-9]*)Knob$/, SLOT_KNOBS = 4, KNOB_OFFSET = { A: 0, B: 4 };

  function param(search, name) {
    const m = new RegExp(`[?&]${name}=([^&#]*)`).exec(String(search || ''));
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch (e) { return ''; }
  }
  const parseSlot = search => (param(search, 'slot').toUpperCase() === 'B' ? 'B' : 'A');
  const step = (i, dir, n) => (n > 0 ? (((i + dir) % n) + n) % n : 0);
  function startIndex(slot, search, n) {
    const k = parseInt(param(search, 'scene'), 10);
    if (Number.isInteger(k) && k >= 1) return step(k - 1, 0, n);
    return step(SLOT_NAMES.indexOf(slot), 0, n);
  }
  /** a channel message -> the step for this slot (-1 | 1), else 0 */
  function slotCommand(msg, slot) {
    if (!msg || typeof msg !== 'object' || msg.type !== 'slot' || msg.slot !== slot) return 0;
    return msg.dir === 1 || msg.dir === -1 ? msg.dir : 0;
  }
  /** a keydown -> -1 | 1 | 0 (no modifier, no repeat, not while typing) */
  function keyDir(e) {
    if (!e || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return 0;
    const tag = e.target && e.target.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type === 'text')) return 0;
    return KEYS[e.key] || 0;
  }
  const PANIC = { blackout: 'blackout', calm: 'calm', clear: 'off' };

  /** the scene's *Knob params (set.json's defaults, then the scene's query) as this slot's knob numbers */
  function slotKnobs(set, scene, slot) {
    const q = Object.assign({}, (set && set.defaults) || {}, (scene && scene.query) || {}), out = {};
    const off = KNOB_OFFSET[slot] || 0;
    for (const [k, v] of Object.entries(q)) {
      if (!KNOB_PARAM.test(k) || v === null || v === undefined) continue;
      const n = parseInt(v, 10);
      out[k] = Number.isInteger(n) && n >= 1 && n <= SLOT_KNOBS ? String(n + off) : String(v);
    }
    return out;
  }
  /** the scene's knobs in this slot: [{ knob (1-8), name }] by knob (names from the params: beatKnob -> beat) */
  function controls(set, scene, slot) {
    const out = [];
    for (const [k, v] of Object.entries(slotKnobs(set, scene, slot))) {
      const n = parseInt(v, 10);
      if (Number.isInteger(n) && n >= 1 && n <= 8) out.push({ knob: n, name: KNOB_PARAM.exec(k)[1] });
    }
    return out.sort((a, b) => a.knob - b.knob);
  }

  function create(o) {
    const SetLib = o.SetLib || root.SetLib;
    const doc = o.doc, set = o.set, slot = o.slot === 'B' ? 'B' : 'A', n = set.scenes.length;
    const now = o.now || (() => (root.performance ? root.performance.now() : Date.now()));
    const setT = o.setTimeout || ((f, ms) => root.setTimeout(f, ms)), clearT = o.clearTimeout || (h => root.clearTimeout(h));
    const setI = o.setInterval || ((f, ms) => root.setInterval(f, ms)), clearI = o.clearInterval || (h => root.clearInterval(h));
    const readyMs = o.readyMs || READY_MS, pollMs = o.pollMs || POLL_MS;
    const stage = doc.getElementById('stage') || doc.body, cover = doc.getElementById('cover');
    let index = step(Number.isInteger(o.start) ? o.start : SLOT_NAMES.indexOf(slot), 0, n);
    let frame = null, token = 0, poll = null, deadline = null, loading = false, panicMode = 'off', loads = 0, lost = 0;
    const switches = [];
    const url = i => SetLib.buildUrl(set, set.scenes[i], Object.assign(slotKnobs(set, set.scenes[i], slot), o.inLabel ? { in: o.inLabel } : {}));
    let controlsSent = 0;
    // the scene's knobs to the conductor (its controls line, the LEDs)
    function sendControls() {
      if (!o.channel || typeof o.channel.postMessage !== 'function') return null;
      const sc = set.scenes[index], m = { type: 'controls', v: 1, slot, scene: sc.name || sc.page, controls: controls(set, sc, slot) };
      try { o.channel.postMessage(m); controlsSent++; } catch (e) { return null; }
      return m;
    }
    const setCover = on => { if (cover && cover.classList) cover.classList.toggle('on', !!on); };
    const coverOn = () => !!(cover && cover.classList && cover.classList.contains('on'));
    if (doc.title !== undefined) doc.title = `slot ${slot}`;

    function onKey(e) {
      const d = keyDir(e);
      if (!d) return false;
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      api.step(d);
      return true;
    }
    function onLost() { if (!loading) lost++; }
    // the old scene: its main WebGL context lost first (contexts do not pile up over many switches), then removed
    function teardown(f) {
      if (!f) return;
      let w = null;
      try { w = f.contentWindow; } catch (e) { w = null; }
      if (w) {
        try { w.removeEventListener('keydown', onKey, true); } catch (e) {}
        try { w.document.removeEventListener('webglcontextlost', onLost, true); } catch (e) {}
        try {
          const c = w.document.getElementById('c');
          for (const t of ['webgl2', 'webgl']) {
            const g = c && c.getContext ? c.getContext(t) : null;
            if (g) { const x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); break; }
          }
        } catch (e) { /* a scene without a WebGL #c */ }
      }
      try { f.src = 'about:blank'; } catch (e) {}
      try { if (f.remove) f.remove(); else if (f.parentNode) f.parentNode.removeChild(f); } catch (e) {}
    }
    function stopWaiting() {
      if (poll !== null) { clearI(poll); poll = null; }
      if (deadline !== null) { clearT(deadline); deadline = null; }
    }
    function ready(sw, timedOut) {
      stopWaiting();
      loading = false;
      if (timedOut) sw.timeout = true; else sw.lockedAt = now();
      setCover(panicMode === 'blackout');
    }
    function locked(w) {
      try { const s = w && w.__qa && w.__qa.sharedClock; return !!(s && s.state === 'locked'); } catch (e) { return false; }
    }
    function show(i) {
      index = step(i, 0, n);
      const my = ++token, sw = { i: index, name: set.scenes[index].name || set.scenes[index].page, url: url(index), t0: now(), loadAt: null, lockedAt: null, timeout: false };
      switches.push(sw); if (switches.length > SWITCHES_KEPT) switches.shift();
      setCover(true); loading = true;   // black at once: no flash of the old or a half-drawn scene
      stopWaiting();
      teardown(frame); frame = null;
      const f = doc.createElement('iframe');
      f.setAttribute('allow', 'autoplay; microphone');
      f.setAttribute('title', `slot ${slot}: ${sw.name}`);
      f.className = 'scene';
      f.addEventListener('load', () => {
        if (my !== token) return;
        let w = null;
        try { w = f.contentWindow; } catch (e) { w = null; }
        if (!w || (w.location && w.location.href === 'about:blank')) return;
        sw.loadAt = now(); loads++;
        try { w.addEventListener('keydown', onKey, true); } catch (e) {}
        try { w.document.addEventListener('webglcontextlost', onLost, true); } catch (e) {}
        try { if (panicMode !== 'off' && w.__panic && w.__panic.set) w.__panic.set(panicMode); } catch (e) {}
        try { if (w.focus) w.focus(); } catch (e) {}
        if (locked(w)) { ready(sw, false); return; }
        poll = setI(() => { if (my === token && locked(w)) ready(sw, false); }, pollMs);
      });
      deadline = setT(() => { if (my === token && loading) ready(sw, true); }, readyMs);
      f.src = sw.url;
      stage.appendChild(f);
      frame = f;
      sendControls();
      return sw;
    }
    function onMessage(msg) {
      const d = slotCommand(msg, slot);
      if (d) { api.step(d); return; }
      if (msg && msg.type === 'controls-ask') { sendControls(); return; }
      if (msg && msg.type === 'panic' && PANIC[msg.mode]) {
        panicMode = PANIC[msg.mode];
        if (panicMode === 'blackout') setCover(true);
        else if (!loading) setCover(false);
      }
    }
    const api = {
      show, onMessage, onKey,
      step(dir) { return show(step(index, dir, n)); },
      get frame() { return frame; },
      get qa() {
        return { slot, index, scene: set.scenes[index].name || set.scenes[index].page, url: url(index), n, loading, coverOn: coverOn(),
          panicMode, loads, lost, controls: controls(set, set.scenes[index], slot), controlsSent, frames: stage && stage.querySelectorAll ? stage.querySelectorAll('iframe').length : null,
          switches: switches.map(s => ({ ...s })) };
      },
      stop() { stopWaiting(); token++; teardown(frame); frame = null; },
    };
    if (o.win && o.win.addEventListener) o.win.addEventListener('keydown', onKey, true);
    if (o.channel) o.channel.onmessage = e => onMessage(e && e.data);
    return api;
  }

  const api = { SLOT_NAMES, READY_MS, KEYS, KNOB_OFFSET, SLOT_KNOBS, parseSlot, startIndex, step, slotCommand, keyDir, slotKnobs, controls, create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SlotLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
