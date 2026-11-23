// The beat relay (docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md, task 1): a WebSocket relay inside conduct-serve (same
// origin, same port, no new process) that carries what the BroadcastChannel 'cellular-viz-clock' carries today, so a
// page in OBS's own browser (where the channel does not reach) gets the clock, the knobs, the slot commands and panic.
// No library: the WebSocket framing (RFC 6455, text frames only) is here, about 150 lines, for the server and for the
// node client the tests and the delay report use. Browsers use their own WebSocket.
//
// The relay is a bus, like the channel: every message a client sends goes to every OTHER client (never back to the
// sender). The conductor stays the only authority (it decides the clock and publishes it); the relay decides nothing,
// it passes messages on and remembers the latest state:
//   - clock: the last { type: 'clock' }      - knobs: the last { type: 'knobs' }
//   - panic: the last { type: 'panic' } unless its mode is 'clear' (a scene loaded during a blackout stays black)
//   - controls: the last { type: 'controls' } of each slot (A, B)
// A client that joins gets { type: 'hello', v, ok: true, relay, t, clients } and then that state at once (knobs,
// controls A, controls B, panic, clock), each marked late: true. Jumps and slot steps are events and are not replayed.
//
// Protocol (version RELAY_VERSION = 1)
//   - Connect to /relay?v=1. Another v: { type: 'hello', v: 1, ok: false, error: 'version', want: 1 }, then close 4001.
//   - Every message is one JSON object in one text frame (at most MAX_MSG bytes) with v: 1 and a type ([a-z-], 32
//     chars at most). Messages that do not fit are not passed on; the sender hears { type: 'relay-error', v, error }
//     (the first 3 times). 'hello' and 'relay-error' come only from the relay.
//   - Every message passed on gets rt: the relay's wall time (ms) when it arrived, for the delay report (task 6).
//     The clock messages carry their own time t (performance.timeOrigin + performance.now()), so relay delay does not
//     move the beat; receivers ignore rt and late.
//   - Reserved for beat sources (none is built in this brief): { type: 'source', v: 1, id, t, beats, bpm, confidence }
//     (id [a-z0-9_-], numbers finite); the brief writes it as kind: 'source', which is taken as type 'source'.
//   - A subscriber with more than slowBytes not yet sent (it stopped reading) is cut off, so it never holds up the
//     others or grows the server's memory. Every pingMs the relay pings; a client silent for 2 x pingMs is cut off.
//   - Nothing is logged per message (R9: no names of people or tracks reach a log); stats() counts only.
//
//   createRelay({ now, slowBytes, pingMs, maxMsg }) -> { attach(httpServer), stats(), close(), clients }
//   connect(url, { timeoutMs }) -> Promise<RelayClient>: { send(msg), close(code), messages, wait(pred, ms), waitClosed(ms) }
import crypto from 'node:crypto';
import net from 'node:net';
import { EventEmitter } from 'node:events';

export const RELAY_PATH = '/relay';
export const RELAY_VERSION = 1;
export const MAX_MSG = 64 << 10;
export const SLOW_BYTES = 1 << 20;
export const PING_MS = 15000;
export const SERVER_TYPES = ['hello', 'relay-error'];
const TYPE_RE = /^[a-z][a-z-]{0,31}$/, SOURCE_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** the Sec-WebSocket-Accept value for a client's key (RFC 6455 4.2.2) */
export const acceptKey = key => crypto.createHash('sha1').update(String(key) + GUID).digest('base64');

/** one final frame: opcode, payload (Buffer or string), masked (a client's frames must be) */
export function encodeFrame(opcode, payload, mask = false) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload == null ? '' : payload), 'utf8');
  const n = data.length, head = n < 126 ? 2 : n < 65536 ? 4 : 10;
  const out = Buffer.alloc(head + (mask ? 4 : 0) + n);
  out[0] = 0x80 | (opcode & 0x0f);
  if (n < 126) out[1] = n;
  else if (n < 65536) { out[1] = 126; out.writeUInt16BE(n, 2); }
  else { out[1] = 127; out.writeUInt32BE(Math.floor(n / 2 ** 32), 2); out.writeUInt32BE(n % 2 ** 32, 6); }
  if (mask) {
    out[1] |= 0x80;
    const k = crypto.randomBytes(4);
    k.copy(out, head);
    for (let i = 0; i < n; i++) out[head + 4 + i] = data[i] ^ k[i & 3];
  } else data.copy(out, head);
  return out;
}

/** bytes in, whole frames out ({ fin, opcode, masked, payload }); a frame over max throws (code 1009) */
export class FrameReader {
  constructor(max = MAX_MSG) { this.buf = Buffer.alloc(0); this.max = max; }
  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const frames = [];
    for (;;) {
      const b = this.buf;
      if (b.length < 2) break;
      const fin = (b[0] & 0x80) !== 0, opcode = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let n = b[1] & 0x7f, off = 2;
      if (n === 126) { if (b.length < 4) break; n = b.readUInt16BE(2); off = 4; }
      else if (n === 127) { if (b.length < 10) break; n = b.readUInt32BE(2) * 2 ** 32 + b.readUInt32BE(6); off = 10; }
      if (n > this.max) { const e = new Error('frame too large'); e.code = 1009; throw e; }
      const start = off + (masked ? 4 : 0), need = start + n;
      if (b.length < need) break;
      const payload = Buffer.from(b.subarray(start, need));   // a copy: unmasked in place
      if (masked) for (let i = 0; i < n; i++) payload[i] ^= b[off + (i & 3)];
      frames.push({ fin, opcode, masked, payload });
      this.buf = b.subarray(need);
    }
    return frames;
  }
}

/** one WebSocket end on a socket: 'message' (text), 'close' (code, once). mask: true on the client side */
export class Peer extends EventEmitter {
  constructor(socket, { mask = false, max = MAX_MSG } = {}) {
    super();
    this.socket = socket; this.mask = mask; this.reader = new FrameReader(max); this.max = max;
    this.parts = null; this.partsLen = 0; this.closed = false; this.done = false; this.closeCode = null;
    this.lastSeen = Date.now();
    if (typeof socket.setNoDelay === 'function') socket.setNoDelay(true);
    socket.on('data', c => this.onData(c));
    socket.on('close', () => this.finish(1006));
    socket.on('error', () => this.finish(1006));
  }
  get buffered() { return this.socket.writableLength || 0; }
  onData(chunk) {
    this.lastSeen = Date.now();
    let frames;
    try { frames = this.reader.push(chunk); } catch (e) { this.close(e.code || 1002, 'too large'); return; }
    for (const f of frames) {
      if (this.closed) return;
      if (!this.mask && !f.masked) { this.close(1002, 'unmasked'); return; }   // the server side: client frames are masked
      if (f.opcode === 8) {
        const code = f.payload.length >= 2 ? f.payload.readUInt16BE(0) : 1005;
        this.closeCode = code;
        this.writeFrame(8, f.payload.subarray(0, 2));
        this.finish(code);
        return;
      }
      if (f.opcode === 9) { this.writeFrame(10, f.payload); continue; }
      if (f.opcode === 10) continue;
      if (f.opcode === 1 || f.opcode === 2) {
        if (this.parts) { this.close(1002, 'interleaved'); return; }
        if (f.opcode === 2) { this.close(1003, 'text only'); return; }
        if (f.fin) this.emit('message', f.payload.toString('utf8'));
        else { this.parts = [f.payload]; this.partsLen = f.payload.length; }
        continue;
      }
      if (f.opcode === 0) {
        if (!this.parts) { this.close(1002, 'continuation'); return; }
        this.parts.push(f.payload); this.partsLen += f.payload.length;
        if (this.partsLen > this.max) { this.close(1009, 'too large'); return; }
        if (f.fin) { const text = Buffer.concat(this.parts).toString('utf8'); this.parts = null; this.emit('message', text); }
        continue;
      }
      this.close(1002, 'opcode');
      return;
    }
  }
  writeFrame(opcode, payload) {
    if (this.socket.destroyed || !this.socket.writable) return false;
    this.socket.write(encodeFrame(opcode, payload, this.mask));
    return true;
  }
  send(msg) { return this.closed ? false : this.writeFrame(1, typeof msg === 'string' ? msg : JSON.stringify(msg)); }
  ping() { if (!this.closed) this.writeFrame(9, ''); }
  close(code = 1000, reason = '') {
    if (this.closed) return;
    const r = Buffer.from(String(reason).slice(0, 100), 'utf8'), p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code, 0); r.copy(p, 2);
    this.writeFrame(8, p);
    this.closeCode = code;
    this.finish(code);
  }
  destroy() { this.socket.destroy(); this.finish(1006); }
  finish(code) {
    if (this.done) return;
    this.done = true; this.closed = true;
    if (this.closeCode == null) this.closeCode = code;
    try { this.socket.end(); } catch (e) { /* gone already */ }
    const s = this.socket;
    setTimeout(() => s.destroy(), 1000).unref();
    this.emit('close', this.closeCode);
  }
}

/** '' when a client's message may be passed on, else why not */
export function checkMessage(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return 'not an object';
  if (m.type === undefined && m.kind === 'source') m.type = 'source';   // the brief's spelling of the reserved kind
  if (m.v !== RELAY_VERSION) return 'version';
  if (typeof m.type !== 'string' || !TYPE_RE.test(m.type)) return 'type';
  if (SERVER_TYPES.includes(m.type)) return 'reserved';
  if (m.type === 'source') {
    if (typeof m.id !== 'string' || !SOURCE_ID.test(m.id)) return 'source id';
    for (const k of ['t', 'beats', 'bpm', 'confidence']) if (!Number.isFinite(m[k])) return `source ${k}`;
  }
  return '';
}

export function createRelay({ now = () => Date.now(), slowBytes = SLOW_BYTES, pingMs = PING_MS, maxMsg = MAX_MSG } = {}) {
  const clients = new Set();
  const state = { clock: null, knobs: null, panic: null, controls: new Map() };
  const counts = { joined: 0, left: 0, in: 0, out: 0, rejected: 0, slow: 0, silent: 0, versionRefused: 0 };
  let timer = null;

  function remember(m) {
    if (m.type === 'clock' || m.type === 'knobs') state[m.type] = m;
    else if (m.type === 'panic') state.panic = m.mode === 'clear' ? null : m;
    else if (m.type === 'controls' && (m.slot === 'A' || m.slot === 'B')) state.controls.set(m.slot, m);
  }
  function snapshot() {
    const out = [];
    if (state.knobs) out.push(state.knobs);
    for (const s of ['A', 'B']) if (state.controls.has(s)) out.push(state.controls.get(s));
    if (state.panic) out.push(state.panic);
    if (state.clock) out.push(state.clock);
    return out.map(m => ({ ...m, late: true }));
  }
  function deliver(c, text) {
    if (c.peer.closed) return;
    if (c.peer.buffered > slowBytes) { counts.slow++; c.peer.destroy(); return; }   // stopped reading: cut off, the rest go on
    c.peer.send(text); counts.out++;
  }
  function onMessage(c, text) {
    counts.in++;
    let m = null;
    try { m = JSON.parse(text); } catch (e) { m = null; }
    const err = m === null ? 'not JSON' : checkMessage(m);
    if (err) {
      counts.rejected++; c.rejected++;
      if (c.rejected <= 3) c.peer.send({ type: 'relay-error', v: RELAY_VERSION, error: err });
      return;
    }
    m.rt = now();
    remember(m);
    const out = JSON.stringify(m);
    for (const o of clients) if (o !== c) deliver(o, out);
  }
  function join(peer, v) {
    if (v !== String(RELAY_VERSION)) {
      counts.versionRefused++;
      peer.send({ type: 'hello', v: RELAY_VERSION, ok: false, error: 'version', want: RELAY_VERSION });
      peer.close(4001, 'version');
      return null;
    }
    const c = { peer, rejected: 0 };
    clients.add(c); counts.joined++;
    peer.on('message', text => onMessage(c, text));
    peer.on('close', () => { if (clients.delete(c)) counts.left++; });
    peer.send({ type: 'hello', v: RELAY_VERSION, ok: true, relay: RELAY_VERSION, t: now(), clients: clients.size });
    for (const m of snapshot()) peer.send(m);
    return c;
  }
  function onUpgrade(req, socket, head) {
    let url;
    try { url = new URL(req.url, 'http://local'); } catch (e) { url = null; }
    if (!url || url.pathname !== RELAY_PATH) { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return; }
    const key = req.headers['sec-websocket-key'];
    if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      return;
    }
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`);
    const peer = new Peer(socket, { max: maxMsg });
    join(peer, url.searchParams.get('v'));
    if (head && head.length) peer.onData(head);
  }
  function sweep() {
    const t = Date.now();
    for (const c of clients) {
      if (t - c.peer.lastSeen > 2 * pingMs) { counts.silent++; c.peer.destroy(); }
      else c.peer.ping();
    }
  }
  return {
    clients,
    attach(server) {
      server.on('upgrade', onUpgrade);
      if (!timer && pingMs > 0) { timer = setInterval(sweep, pingMs); timer.unref(); }
      return this;
    },
    stats() {
      return { version: RELAY_VERSION, clients: clients.size, ...counts,
        state: { clock: !!state.clock, knobs: !!state.knobs, panic: state.panic ? state.panic.mode : null, controls: [...state.controls.keys()] } };
    },
    close() {
      if (timer) { clearInterval(timer); timer = null; }
      for (const c of [...clients]) c.peer.close(1001, 'server going away');
      clients.clear();
    },
  };
}

/** the node side of a relay connection (tests, the delay report); messages are kept in order */
export class RelayClient extends EventEmitter {
  constructor(peer) {
    super();
    this.peer = peer; this.messages = []; this.closed = null;
    peer.on('message', text => { let m; try { m = JSON.parse(text); } catch (e) { return; } this.messages.push(m); this.emit('msg', m); });
    peer.on('close', code => { this.closed = code; this.emit('closed', code); });
  }
  send(m) { return this.peer.send(m); }
  close(code = 1000) { this.peer.close(code); }
  /** the first message (from index `from` on) that fits pred, waiting up to ms */
  wait(pred, ms = 3000, from = 0) {
    return new Promise((resolve, reject) => {
      const hit = this.messages.slice(from).find(pred);
      if (hit) { resolve(hit); return; }
      const on = m => { if (pred(m)) { clearTimeout(t); this.off('msg', on); resolve(m); } };
      const t = setTimeout(() => { this.off('msg', on); reject(new Error(`relay client: no such message in ${ms} ms`)); }, ms);
      this.on('msg', on);
    });
  }
  waitClosed(ms = 3000) {
    return new Promise((resolve, reject) => {
      if (this.closed !== null) { resolve(this.closed); return; }
      const t = setTimeout(() => reject(new Error(`relay client: still open after ${ms} ms`)), ms);
      this.once('closed', code => { clearTimeout(t); resolve(code); });
    });
  }
}

/** open ws://host:port/relay?v=1 from node (no TLS) */
export function connect(url, { timeoutMs = 5000 } = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect({ host: u.hostname, port: +u.port || 80 });
    let buf = Buffer.alloc(0), done = false;
    const fail = e => { if (done) return; done = true; clearTimeout(timer); sock.destroy(); reject(e); };
    const timer = setTimeout(() => fail(new Error('relay: connect timeout')), timeoutMs);
    const onHead = chunk => {
      buf = Buffer.concat([buf, chunk]);
      const end = buf.indexOf('\r\n\r\n');
      if (end < 0) return;
      sock.off('data', onHead);
      const head = buf.subarray(0, end).toString('latin1'), rest = buf.subarray(end + 4);
      if (!/^HTTP\/1\.1 101/.test(head)) { fail(new Error(`relay: ${head.split('\r\n')[0]}`)); return; }
      const acc = /sec-websocket-accept:\s*(\S+)/i.exec(head);
      if (!acc || acc[1] !== acceptKey(key)) { fail(new Error('relay: bad accept key')); return; }
      done = true; clearTimeout(timer); sock.off('error', fail);
      const client = new RelayClient(new Peer(sock, { mask: true }));
      resolve(client);
      if (rest.length) client.peer.onData(rest);
    };
    sock.on('error', fail);
    sock.on('data', onHead);
    sock.on('connect', () => sock.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\n` +
      `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
  });
}
