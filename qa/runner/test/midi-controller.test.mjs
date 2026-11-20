// The controller (experiments/midi-controller.js; docs/LCXL3_MAC_BRIEF.md Job 2) against a fake MIDIAccess: every
// lower-row button → its clock.fix, every clock state → the tap LED's bytes, the display lines, the Mode Select trap,
// hot-plug, no SysEx, no device, and the constants equal to the hardware-checked map (experiments/lcxl3.map.json).
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const M = require('../../../experiments/midi-controller.js');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/lcxl3.map.json'), 'utf8'));

function port(name, type) {
  return { name, type, state: 'connected', onmidimessage: null, sent: [], at: [], send(b, at) { this.sent.push([...b]); this.at.push(at); } };
}
function fakeAccess({ sysex = true, withDevice = true, iac = false } = {}) {
  const a = { sysexEnabled: sysex, inputs: new Map(), outputs: new Map(), onstatechange: null };
  if (iac) a.outputs.set('out-iac', port('IAC Driver Bus 1', 'output'));
  if (withDevice) plug(a);
  return a;
}
function plug(a) {
  a.inputs.set('in-midi', port('LCXL3 1 MIDI Out', 'input')); a.inputs.set('in-daw', port('LCXL3 1 DAW Out', 'input'));
  a.outputs.set('out-midi', port('LCXL3 1 MIDI In', 'output')); a.outputs.set('out-daw', port('LCXL3 1 DAW In', 'output'));
  if (a.onstatechange) a.onstatechange({});
}
function unplug(a) {
  for (const m of [a.inputs, a.outputs]) for (const p of m.values()) if (/LCXL3/.test(p.name)) p.state = 'disconnected';
  if (a.onstatechange) a.onstatechange({});
}
function fakeClock() {
  return { playing: true, trackerState: { state: 'locked' }, r: { beats: 10.1, phase: 0.1, bpm: 124, confidence: 0.82 }, fixes: [], result: null,
    // live: { b0, t0 } → the beats run on from b0 at the rig's time t0 (tempo r.bpm), as a locked clock's do
    read() { if (!this.live) return this.r; const beats = this.live.b0 + (this.nowRef() - this.live.t0) * this.r.bpm / 60000; return { ...this.r, beats, phase: beats - Math.floor(beats) }; }, fix(kind, arg, o) { this.fixes.push({ kind, arg, origin: o.origin, eventTs: o.eventTs }); return this.result; } };
}
async function rig(o = {}) {
  const access = o.access || fakeAccess(o), clock = fakeClock(), timers = [], statuses = [];
  let now = 1000;
  const nav = o.noMidi ? {} : { requestMIDIAccess: async q => { if (o.deny) throw new Error('denied'); if (o.denySysex && q && q.sysex) throw new Error('no sysex'); return access; } };
  const bridges = [];
  const ctl = M.create({ clock, navigator: nav, perfNow: () => now, lastFix: () => o.lastFix || '', storage: o.storage, onBridge: (b, n) => bridges.push([b, n]), toggleAutoHold: o.toggleAutoHold, onKnob: o.onKnob, onSlot: o.onSlot, log: o.log,
    setInterval: () => 1, clearInterval: () => {}, setTimeout: (f, ms) => { timers.push({ f, at: now + ms }); return timers.length; },
    clearTimeout: h => { timers[h - 1] = null; }, onStatus: s => statuses.push(s) });
  clock.nowRef = () => now;
  await ctl.start();
  const out = () => access.outputs.get('out-daw'), inp = () => access.inputs.get('in-daw');
  const press = (cc, v = 127, ts = 5) => inp().onmidimessage({ data: [0xB0, cc, v], timeStamp: ts });
  const advance = ms => { now += ms; for (const t of timers) if (t && t.at <= now) { t.f(); timers[timers.indexOf(t)] = null; } };
  return { access, clock, ctl, out, inp, press, advance, statuses, bridges, now: () => now, clear: () => { out().sent.length = 0; out().at.length = 0; } };
}
const hex = b => b.map(x => x.toString(16).padStart(2, '0')).join(' ');

test('the constants are the hardware-checked map (lcxl3.map.json, 15 Nov)', () => {
  assert.deepEqual(M.MAP.LOWER, MAP.buttons.lowerRow.ccs);
  assert.equal(MAP.buttons.channel, 1);
  assert.equal(M.MAP.BUTTON_CH, 0xB0);
  assert.equal(M.MAP.FLASH_CH, MAP.palette.flash.status);
  for (const c of ['off', 'red', 'amber', 'green']) assert.equal(M.MAP.COLOUR[c], MAP.palette[c].index, c);
  assert.deepEqual(M.MAP.DAW_ON, MAP.dawMode.on);
  assert.deepEqual(M.MAP.DAW_OFF, MAP.dawMode.off);
  assert.equal(M.MAP.MODE_CC, 30);
  assert.equal(M.MAP.FEATURE_CH, 0xB0 + MAP.channels.feature - 1);
  assert.equal(M.MAP.QUERY_CH, 0xB0 + MAP.channels.query - 1);
  assert.equal(M.MAP.DISPLAY_TARGET, MAP.display.textTarget);
  for (const k of ['off', 'red', 'amber', 'green', 'flash']) assert.equal(MAP.palette[k].verified, 'hardware 15 Nov', k);
  for (const k of [MAP.buttons.lowerRow, MAP.dawMode, MAP.display, MAP.surfaceMode]) assert.equal(k.verified, 'hardware 15 Nov');
  // hand-held mode (#239): hold and auto-hold on the first two upper-row buttons, named in the map
  assert.deepEqual([M.MAP.HOLD_CC, M.MAP.AUTO_HOLD_CC], [37, 38]);
  for (const cc of M.MAP.UPPER) assert.ok(MAP.buttons.upperRow.ccs.includes(cc), `${cc} is an upper-row button`);
  assert.match(MAP.buttons.upperRow.use['37'], /^hold/);
  assert.match(MAP.buttons.upperRow.use['38'], /^auto-hold/);
});

test('hold (upper 1, CC 37) and auto-hold (upper 2, CC 38): one press each, origin fix:controller; the page keeps auto-hold when it gives toggleAutoHold', async () => {
  const { clock, press } = await rig();
  press(37, 127, 200); press(37, 0, 250);
  press(38, 127, 300); press(38, 0, 350);
  assert.deepEqual(clock.fixes, [{ kind: 'hold', arg: undefined, origin: 'fix:controller', eventTs: 200 }, { kind: 'autoHold', arg: undefined, origin: 'fix:controller', eventTs: 300 }], 'a release does nothing');
  const toggles = [];
  const r = await rig({ toggleAutoHold: origin => toggles.push(origin) });
  r.press(38, 127, 400); r.press(38, 0, 450);
  assert.deepEqual(toggles, ['fix:controller'], 'the page\'s toggle (localStorage) gets the press');
  assert.deepEqual(r.clock.fixes, [], 'and the controller does not switch it a second time');
});

test('hold LED: green held, amber held + holdSuspect, dark not held; auto-hold LED green on, dark off; both dark on stop', async () => {
  const { clock, ctl, out, clear } = await rig();
  const led = cc => { clear(); ctl.tick(); return out().sent.filter(b => b[1] === cc).map(hex); };
  assert.deepEqual(led(37), ['b0 25 00'], 'not held: dark');
  clock.trackerState = { state: 'locked', held: { on: true, suspect: false } };
  assert.deepEqual(led(37), ['b0 25 15'], 'held: green 21');
  assert.deepEqual(led(37), [], 'diffed: nothing more');
  clock.trackerState = { state: 'locked', held: { on: true, suspect: true } };
  assert.deepEqual(led(37), ['b0 25 09'], 'held + suspect: amber 9');
  clock.trackerState = { state: 'locked', held: { on: false, suspect: true } };
  assert.deepEqual(led(37), ['b0 25 00'], 'released: dark (a stale suspect does not light it)');
  clock.autoHold = true;
  assert.deepEqual(led(38), ['b0 26 15'], 'auto-hold on: green');
  clock.autoHold = false;
  assert.deepEqual(led(38), ['b0 26 00'], 'auto-hold off: dark');
  clock.autoHold = true; clock.trackerState = { state: 'locked', held: { on: true } }; ctl.tick();
  clear(); ctl.stop();
  const s = out().sent.map(hex);
  assert.ok(s.includes('b0 25 00') && s.includes('b0 26 00'), 'stop darkens both');
  assert.equal(s[s.length - 1], '9f 0c 00', 'DAW mode off stays last');
});

test('start: the DAW ports by name, DAW mode on, the surface mode asked, the display configured', async () => {
  const { out, inp, ctl, access } = await rig();
  assert.equal(ctl.status, 'connected');
  assert.equal(ctl.sysex, true);
  assert.equal(typeof inp().onmidimessage, 'function');
  assert.equal(access.inputs.get('in-midi').onmidimessage, null, 'the standalone port is left alone');
  assert.equal(access.outputs.get('out-midi').sent.length, 0);
  assert.deepEqual(out().sent.slice(0, 3).map(hex), ['9f 0c 7f', 'b7 1e 00', 'f0 00 20 29 02 15 04 35 01 f7']);
});

test('every lower-row button → its clock.fix with origin fix:controller and the event time', async () => {
  const { clock, press } = await rig();
  const want = [['tap'], ['flip'], ['half'], ['x2'], ['nudge', -10], ['nudge', 10], ['setOne']];
  want.forEach(([kind], i) => { press(45 + i, 127, 100 + i); press(45 + i, 0, 150 + i); });
  assert.deepEqual(clock.fixes, want.map(([kind, arg], i) => ({ kind, arg, origin: 'fix:controller', eventTs: 100 + i })));
});

test('restart fires only after a 1 s hold; an early release does nothing', async () => {
  const { clock, press, advance } = await rig();
  press(52); advance(900); press(52, 0); advance(500);
  assert.equal(clock.fixes.length, 0);
  press(52); advance(999); assert.equal(clock.fixes.length, 0);
  advance(1); assert.deepEqual(clock.fixes.map(f => [f.kind, f.origin]), [['restart', 'fix:controller']]);
  press(52, 0); advance(2000); assert.equal(clock.fixes.length, 1);
});

test('the upper row\'s slot and audition buttons (CC 39-44), the pots, the faders and Shift make no clock fix', async () => {
  const { clock, inp } = await rig();
  for (let cc = 39; cc <= 44; cc++) inp().onmidimessage({ data: [0xB0, cc, 127] });   // 37 and 38: hold, auto-hold (#239)
  for (let cc = 5; cc <= 36; cc++) inp().onmidimessage({ data: [0xBF, cc, 64] });
  inp().onmidimessage({ data: [0xB6, 63, 127] });
  inp().onmidimessage({ data: [0xF0, 0x00, 0xF7] });
  assert.equal(clock.fixes.length, 0);
});

// the tap LED's messages since the last clear: [hex, at (ms after t0, or 'now')]
function tapMsgs(r, t0) {
  const o = r.out();
  return o.sent.map((b, i) => [b, o.at[i]]).filter(([b]) => b[1] === 45).map(([b, at]) => [hex(b), at === undefined ? 'now' : Math.round(at - t0)]);
}
// beats at 120 bpm from beat 10.6 at t0: beat k at t0 + (k − 10.6) × 500 ms
async function beating(tickMs, ms, state = 'locked') {
  const r = await rig();
  r.clock.trackerState = { state }; r.clock.r = { ...r.clock.r, bpm: 120 };
  const t0 = r.now(); r.clock.live = { b0: 10.6, t0 };
  r.clear();
  for (let t = 0; t <= ms; t += tickMs) { r.ctl.tick(); r.advance(tickMs); }
  return tapMsgs(r, t0);
}

test('the tap LED flashes on every beat, booked ahead on the device clock: green locked, amber acquiring, red free-run', async () => {
  for (const [state, idx] of [['locked', '15'], ['acquire', '09'], ['free-run', '05']]) {
    const m = await beating(50, 2000, state);
    // beats 11..14 at 200, 700, 1200, 1700 ms; each on once at its time, off a quarter beat (125 ms) later
    assert.deepEqual(m, [200, 700, 1200, 1700].flatMap(t => [[`b0 2d ${idx}`, t], ['b0 2d 00', t + 125]]), state);
  }
});

test('a covered window (ticks ~1 s apart, Chrome throttling) still gets every beat exactly once', async () => {
  const m = await beating(1000, 4000);
  const ons = m.filter(([h]) => h === 'b0 2d 15').map(([, t]) => t);
  // the first tick knows no gap yet (150 ms ahead): beats from the second tick on are all booked, none twice
  assert.deepEqual(ons, [1200, 1700, 2200, 2700, 3200, 3700, 4200, 4700]);
});

test('the tap LED: steady amber before the first lock, dark with no tracker or stopped', async () => {
  const { clock, ctl, out, clear } = await rig();
  const tapLed = () => { clear(); ctl.tick(); return out().sent.filter(b => b[1] === 45).map(hex); };
  clock.trackerState = { state: 'acquire' }; clock.r = { ...clock.r, beats: -1, phase: 0 };
  assert.deepEqual(tapLed(), ['b0 2d 09'], 'beats -1: steady amber');
  assert.deepEqual(tapLed(), [], 'steady: nothing more sent');
  clock.trackerState = {};
  assert.deepEqual(tapLed(), ['b0 2d 00'], 'no tracker: dark');
  clock.trackerState = { state: 'locked' }; clock.playing = false;
  assert.deepEqual(tapLed(), [], 'stopped: stays dark');
});

test('inside a beat window when the flashing starts: on now, off at the end of the window', async () => {
  const r = await rig();
  r.clock.r = { ...r.clock.r, bpm: 120, beats: 10.1, phase: 0.1 };
  r.clear(); r.ctl.tick();
  assert.deepEqual(tapMsgs(r, r.now()), [['b0 2d 15', 'now'], ['b0 2d 00', 75]]);
});

test('LEDs are diffed: an unchanged frame sends nothing', async () => {
  const { ctl, out, clear } = await rig();
  ctl.tick(); clear(); ctl.tick();
  assert.deepEqual(out().sent, []);
});

test('a rejected tap flashes the tap LED red for 0.6 s, then the flash is cleared', async () => {
  const { clock, ctl, out, clear, press, advance } = await rig();
  clock.result = { kind: 'tap', rejected: 'uneven', tapError: 'missed' };
  clock.r = { ...clock.r, phase: 0.6 };
  ctl.tick(); press(45); clear(); ctl.tick();
  assert.deepEqual(out().sent.filter(b => b[1] === 45).map(hex), ['b1 2d 05']);
  advance(600); clear(); ctl.tick();
  const after = out().sent.filter(b => b[1] === 45).map(hex);
  assert.equal(after[0], 'b1 2d 00', 'the flash is cleared first');
  assert.ok(after.length > 1 && after.slice(1).every(h => h === 'b0 2d 15' || h === 'b0 2d 00'), 'then the beat flashes again');
});

test('the restart LED flashes red while held', async () => {
  const { ctl, out, clear, press } = await rig();
  ctl.tick(); press(52); clear(); ctl.tick();
  assert.deepEqual(out().sent.filter(b => b[1] === 52).map(hex), ['b1 34 05']);
  press(52, 0); clear(); ctl.tick();
  assert.deepEqual(out().sent.filter(b => b[1] === 52).map(hex), ['b1 34 00', 'b0 34 00']);
});

test('display: BPM + state and confidence + last fix on target 35h, only on change, at most every 250 ms', async () => {
  const { clock, ctl, out, clear, advance } = await rig({ lastFix: 'tap' });
  assert.deepEqual(M.displayLines({ playing: true, state: 'locked', bpm: 124, confidence: 0.82, lastFix: 'tap' }), ['124.0 BPM LOCK', 'C82% tap']);
  assert.deepEqual(M.displayLines({ playing: false }), ['---.- BPM STOP', 'C0%']);
  clear(); ctl.tick();
  const sx = out().sent.filter(b => b[0] === 0xF0);
  assert.deepEqual(sx.map(b => String.fromCharCode(...b.slice(9, -1))).slice(0, 2), ['124.0 BPM LOCK', 'C82% tap']);
  assert.deepEqual(sx.slice(-1).map(hex), ['f0 00 20 29 02 15 04 35 7f f7']);
  clear(); clock.r = { ...clock.r, bpm: 125 }; advance(100); ctl.tick();
  assert.equal(out().sent.filter(b => b[0] === 0xF0).length, 0, 'within 250 ms');
  advance(200); clear(); ctl.tick();
  assert.deepEqual(out().sent.filter(b => b[0] === 0xF0).map(b => b[8]), [0, 0x7F], 'only the changed line, then show');
});

test('no SysEx: no display bytes at all, the LEDs and DAW mode still work', async () => {
  const { ctl, out, clock } = await rig({ sysex: false });
  clock.r = { ...clock.r, phase: 0.05 };
  ctl.tick();
  assert.equal(ctl.sysex, false);
  assert.equal(out().sent.filter(b => b[0] === 0xF0).length, 0);
  assert.ok(out().sent.some(b => hex(b) === '9f 0c 7f'));
  assert.ok(out().sent.some(b => hex(b) === 'b0 2d 15'));
});

test('SysEx refused: asks again without it and carries on', async () => {
  const { ctl } = await rig({ denySysex: true, sysex: false });
  assert.equal(ctl.status, 'connected');
});

test('no Web MIDI, or access denied: status no-midi, no crash', async () => {
  assert.equal((await rig({ noMidi: true })).ctl.status, 'no-midi');
  assert.equal((await rig({ deny: true })).ctl.status, 'no-midi');
});

test('no DAW port: no crash; the device plugged in later gets DAW mode; unplugged → no-device', async () => {
  const access = fakeAccess({ withDevice: false });
  const { ctl } = await rig({ access });
  assert.equal(ctl.status, 'no-device');
  ctl.tick();
  plug(access);
  assert.equal(ctl.status, 'connected');
  assert.equal(hex(access.outputs.get('out-daw').sent[0]), '9f 0c 7f');
  unplug(access);
  assert.equal(ctl.status, 'no-device');
  ctl.tick();
  plug(access);
  assert.equal(ctl.status, 'connected');
});

test('Mode Select: a report of another mode sets DAW Mixer back and holds the "press MODE" lamp for 3 s', async () => {
  const { ctl, inp, out, clear, advance, statuses } = await rig();
  clear();
  inp().onmidimessage({ data: [0xB6, 30, 0x16] });
  assert.equal(ctl.status, 'mode-select');
  assert.deepEqual(out().sent.map(hex), ['b6 1e 01']);
  inp().onmidimessage({ data: [0xB6, 30, 1] });   // the echo of our own set
  assert.equal(ctl.status, 'mode-select');
  clear(); ctl.tick();
  assert.ok(out().sent.some(b => b[0] === 0xF0 && String.fromCharCode(...b.slice(9, -1)) === 'PRESS MODE'));
  advance(3000); ctl.tick();
  assert.equal(ctl.status, 'connected');
  assert.ok(statuses.includes('mode-select'));
  clear(); inp().onmidimessage({ data: [0xB6, 30, 2] });
  assert.deepEqual(out().sent, [], 'DAW Control (solo/arm) is fine: nothing sent');
});

test('stop: display cancelled, LEDs dark, DAW mode off last; twice is harmless', async () => {
  const { ctl, out, clear, inp } = await rig();
  clear(); ctl.stop(); ctl.stop();
  const s = out().sent.map(hex);
  assert.equal(s[0], 'f0 00 20 29 02 15 04 35 00 f7');
  assert.equal(s[s.length - 1], '9f 0c 00');
  assert.equal(s.filter(x => x === '9f 0c 00').length, 1);
  for (let cc = 45; cc <= 52; cc++) assert.ok(s.includes(`b0 ${cc.toString(16)} 00`), `LED ${cc} dark`);
  assert.equal(inp().onmidimessage, null);
  assert.equal(ctl.status, 'off');
});

// ---------- the bridge (the orchestrator's decision, 15 Nov): faders and pot rows 2–3 → the IAC bus for Resolume ----------
const memStore = (init = {}) => { const m = { ...init }; return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };

test('bridge: every fader and every pot in rows 2 and 3 → the same bytes on the IAC bus', async () => {
  const { ctl, inp, access, out, clear } = await rig({ iac: true });
  assert.equal(ctl.bridge, 'on');
  assert.equal(ctl.bridgePort, 'IAC Driver Bus 1');
  const iac = access.outputs.get('out-iac');
  clear();
  const sent = [];
  for (let cc = 5; cc <= 12; cc++) sent.push([0xBF, cc, cc * 3]);
  for (let cc = 21; cc <= 36; cc++) sent.push([0xBF, cc, 127 - cc]);
  for (const d of sent) inp().onmidimessage({ data: Uint8Array.from(d), timeStamp: 1 });
  assert.deepEqual(iac.sent, sent);
  assert.equal(ctl.forwarded, sent.length);
  assert.deepEqual(out().sent, [], 'nothing goes back to the device');
});

test('bridge: the page\'s own controls never reach the bus (button rows, pot row 1 absolute and relative, Shift, mode, SysEx)', async () => {
  const { inp, access, clock } = await rig({ iac: true });
  const iac = access.outputs.get('out-iac');
  const own = [];
  for (let cc = 37; cc <= 52; cc++) own.push([0xB0, cc, 127], [0xB0, cc, 0]);
  for (let cc = 13; cc <= 20; cc++) own.push([0xBF, cc, 64]);
  for (let cc = 77; cc <= 84; cc++) own.push([0xBF, cc, 65]);
  own.push([0xB6, 63, 127], [0xB6, 30, 1], [0xB0, 5, 64], [0xF0, 0x00, 0x20, 0x29, 0xF7], [0xBF, 4, 1], [0xBF, 37, 1]);
  for (const d of own) inp().onmidimessage({ data: d, timeStamp: 1 });
  assert.deepEqual(iac.sent, []);
  // by kind: the 7 lower-row fixes (restart waits for its hold) and, since #239 c2, hold and autoHold from upper CC 37 / 38
  const kinds = clock.fixes.map(f => f.kind);
  assert.deepEqual(kinds.filter(k => k !== 'hold' && k !== 'autoHold'), ['tap', 'flip', 'half', 'x2', 'nudge', 'nudge', 'setOne'], 'the lower row still drives the clock (restart waits for its hold)');
  assert.deepEqual(kinds.filter(k => k === 'hold' || k === 'autoHold'), ['hold', 'autoHold'], 'upper CC 37 / 38: hold and auto-hold, one each (presses only)');
  for (const d of own) assert.equal(M.forwarded(d), false, hex(d));
});

test('bridge: no IAC port → lamp off, faders dropped, no crash; the bus appearing later turns it on', async () => {
  const { ctl, inp, access } = await rig();
  assert.equal(ctl.bridge, 'off');
  assert.equal(ctl.bridgePort, null);
  inp().onmidimessage({ data: [0xBF, 5, 64], timeStamp: 1 });
  assert.equal(ctl.forwarded, 0);
  access.outputs.set('out-iac', port('IAC Driver Bus 1', 'output'));
  access.onstatechange({});
  assert.equal(ctl.bridge, 'on');
  inp().onmidimessage({ data: [0xBF, 5, 64], timeStamp: 1 });
  assert.deepEqual(access.outputs.get('out-iac').sent, [[0xBF, 5, 64]]);
});

test('bridge: the chosen bus is kept by name in storage; the device\'s own ports are never offered or used', async () => {
  const access = fakeAccess({ iac: true });
  access.outputs.set('out-other', port('loopMIDI Port', 'output'));
  const storage = memStore({ [M.MAP.BRIDGE_KEY]: 'loopMIDI Port' });
  const { ctl } = await rig({ access, storage });
  assert.equal(ctl.bridgePort, 'loopMIDI Port');
  assert.deepEqual(ctl.bridgePorts().sort(), ['IAC Driver Bus 1', 'loopMIDI Port']);
  ctl.setBridgePort('IAC Driver Bus 1');
  assert.equal(storage.m[M.MAP.BRIDGE_KEY], 'IAC Driver Bus 1');
  assert.equal(ctl.bridgePort, 'IAC Driver Bus 1');
  ctl.setBridgePort('LCXL3 1 DAW In');
  assert.equal(ctl.bridgePort, 'IAC Driver Bus 1', 'a device port is refused: back to the default bus');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
  assert.equal((await rig({ iac: true, storage: blocked })).ctl.bridge, 'on', 'blocked storage: the default bus');
});

test('bridge: degraded while the device is missing or on the Mode Select page; mode report 6 → re-select DAW Mixer', async () => {
  const access = fakeAccess({ iac: true });
  const { ctl, inp, out, clear, advance, bridges } = await rig({ access });
  assert.equal(ctl.bridge, 'on');
  clear();
  inp().onmidimessage({ data: [0xB6, 30, 6] });
  assert.equal(ctl.status, 'mode-select');
  assert.equal(ctl.bridge, 'degraded');
  assert.deepEqual(out().sent.map(hex), ['b6 1e 01']);
  advance(3000); ctl.tick();
  assert.equal(ctl.bridge, 'on');
  unplug(access);
  assert.equal(ctl.status, 'no-device');
  assert.equal(ctl.bridge, 'degraded');
  assert.deepEqual(bridges.map(b => b[0]), ['on', 'degraded', 'on', 'degraded']);
  ctl.stop();
  assert.equal(ctl.bridge, 'off');
});

// ---------- pot row 1 (the fix list, 19 Nov 22:00): the page's knobs for the scenes, never bridged ----------
test('knobs: pot row 1 (CC 13-20) → ctl.knobs and onKnob (0..1); never on the IAC bus; the faders and rows 2-3 still are', async () => {
  assert.deepEqual(M.MAP.KNOB_CCS, MAP.encoders.absolute.row1, 'row 1 as in the hardware-checked map');
  const calls = [];
  const { ctl, inp, access, clock, out, clear } = await rig({ iac: true, onKnob: (n, v, all) => calls.push([n, v, all]) });
  const iac = access.outputs.get('out-iac');
  clear();
  assert.deepEqual(ctl.knobs, [null, null, null, null, null, null, null, null], 'null until a pot moves');
  inp().onmidimessage({ data: Uint8Array.from([0xBF, 13, 127]), timeStamp: 1 });
  inp().onmidimessage({ data: Uint8Array.from([0xBF, 20, 0]), timeStamp: 2 });
  inp().onmidimessage({ data: Uint8Array.from([0xBF, 15, 64]), timeStamp: 3 });
  assert.deepEqual(ctl.knobs, [1, null, 64 / 127, null, null, null, null, 0]);
  assert.deepEqual(calls.map(c => [c[0], c[1]]), [[1, 1], [8, 0], [3, 64 / 127]], 'onKnob(n 1-8, value)');
  assert.deepEqual(calls[2][2], ctl.knobs, 'with all 8');
  calls[2][2][0] = 0.5;
  assert.equal(ctl.knobs[0], 1, 'onKnob gets a copy');
  assert.deepEqual(M.decode([0xBF, 17, 32]), { type: 'knob', index: 4, value: 32 / 127 });
  // the bridge: row 1 never, the faders and rows 2-3 unchanged
  const bridged = [];
  for (let cc = 5; cc <= 12; cc++) bridged.push([0xBF, cc, cc]);
  for (let cc = 21; cc <= 36; cc++) bridged.push([0xBF, cc, cc]);
  for (const d of bridged) inp().onmidimessage({ data: Uint8Array.from(d), timeStamp: 4 });
  for (let cc = 13; cc <= 20; cc++) inp().onmidimessage({ data: Uint8Array.from([0xBF, cc, 100]), timeStamp: 5 });
  assert.deepEqual(iac.sent, bridged, 'only the faders and pot rows 2-3 on the IAC bus, no row-1 CC');
  assert.ok(!iac.sent.some(d => d[1] >= 13 && d[1] <= 20), 'no CC 13-20 on the bus');
  for (let cc = 13; cc <= 20; cc++) assert.equal(M.forwarded([0xBF, cc, 100]), false);
  assert.deepEqual(ctl.knobs, new Array(8).fill(100 / 127));
  assert.equal(clock.fixes.length, 0, 'the knobs move no clock fix');
  assert.deepEqual(out().sent, [], 'nothing goes back to the device');
  // without onKnob (an older page) the values are still kept
  const plain = await rig();
  plain.inp().onmidimessage({ data: [0xBF, 14, 127], timeStamp: 1 });
  assert.equal(plain.ctl.knobs[1], 1);
});

// ---------- the slot windows (19 Nov; one half of the device per slot, 20 Nov): upper 3/4 slot A, 7/8 slot B ----------
test('slots: upper buttons 3/4 (CC 39/40) = slot A prev/next, 7/8 (CC 43/44) = slot B; presses only, no clock fix, never on the bus', async () => {
  assert.deepEqual(M.MAP.SLOT_CCS, { 39: ['A', -1], 40: ['A', 1], 43: ['B', -1], 44: ['B', 1] });
  for (const cc of [39, 40, 43, 44]) assert.match(MAP.buttons.upperRow.use[String(cc)], /^slot [AB] (previous|next)/, `map: ${cc}`);
  for (const cc of [41, 42]) assert.match(MAP.buttons.upperRow.use[String(cc)], /^audition (previous|next)/, `map: ${cc}`);
  assert.equal(MAP.buttons.upperRow.use['39-40'], undefined);
  assert.deepEqual(M.MAP.UPPER, [37, 38], 'hold and auto-hold stay on 37 / 38');
  const calls = [];
  const { inp, clock, access, out, clear } = await rig({ iac: true, onSlot: (s, d) => calls.push([s, d]) });
  const iac = access.outputs.get('out-iac');
  clear();
  for (const cc of [39, 40, 43, 44]) { inp().onmidimessage({ data: [0xB0, cc, 127], timeStamp: 1 }); inp().onmidimessage({ data: [0xB0, cc, 0], timeStamp: 2 }); }
  assert.deepEqual(calls, [['A', -1], ['A', 1], ['B', -1], ['B', 1]], 'one call per press, none on release');
  assert.equal(clock.fixes.length, 0, 'no clock fix');
  assert.deepEqual(iac.sent, [], 'not bridged');
  assert.deepEqual(out().sent, [], 'no LED or display bytes');
  for (const cc of [41, 42]) inp().onmidimessage({ data: [0xB0, cc, 127], timeStamp: 3 });
  assert.equal(calls.length, 4, 'CC 41 / 42 (the audition page\'s) step no slot');
  assert.deepEqual(M.decode([0xB0, 39, 127]), { type: 'slot', slot: 'A', dir: -1, down: true });
  assert.equal(M.decode([0xB0, 41, 127]), null);
  inp().onmidimessage({ data: [0xB0, 37, 127], timeStamp: 4 });
  assert.deepEqual(clock.fixes.map(f => f.kind), ['hold'], 'upper 1 is still hold');
  assert.deepEqual(M.decode([0xB0, 43, 127]), { type: 'slot', slot: 'B', dir: -1, down: true });
  // without onSlot (an older page) nothing happens and nothing breaks
  const plain = await rig();
  plain.inp().onmidimessage({ data: [0xB0, 40, 127], timeStamp: 1 });
  assert.equal(plain.clock.fixes.length, 0);
});

// ---------- the encoder LEDs (the user, 20 Nov: highlight the active knobs): slot A blue, slot B orange ----------
const ring = (cc, rgb) => hex(M.encoderLed(cc, rgb));
const encSx = sent => sent.filter(b => b[0] === 0xF0 && b[6] === 0x01 && b[7] === 0x53);
const ringSx = sent => encSx(sent).filter(b => b[8] >= 13 && b[8] <= 20);   // the rings only (not the purple buttons)
test('encoder LEDs: the SysEx bytes, the colours, and which knobs light per slot (from slot.js controls)', () => {
  assert.equal(hex(M.encoderLed(13, [0, 24, 127])), 'f0 00 20 29 02 15 01 53 0d 00 18 7f f7');
  assert.equal(hex(M.encoderLed(20, [200, -3, 64.4])), 'f0 00 20 29 02 15 01 53 14 7f 00 40 f7', 'clamped to 0-127, whole numbers');
  assert.deepEqual(M.MAP.SYSEX, [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15]);
  const { A, B, off } = M.MAP.KNOB_RGB;
  assert.ok(A[2] === 127 && A[0] === 0 && A[1] < 64, 'slot A blue');
  assert.ok(B[0] === 127 && B[2] === 0 && B[1] > 0 && B[1] < 64, 'slot B orange');
  assert.deepEqual(off, [0, 0, 0]);
  assert.equal(MAP.encoders.ledRgb.sysex, 'F0 00 20 29 02 15 01 53 <cc> R G B F7');
  // the conductor's controls per slot -> the 8 rings of pot row 1
  const both = { A: { slot: 'A', controls: [{ knob: 1, name: 'beat' }, { knob: 2, name: 'dive' }, { knob: 3, name: 'glint' }] },
    B: { slot: 'B', controls: [{ knob: 5, name: 'beat' }, { knob: 6, name: 'pulse' }] } };
  assert.deepEqual(M.knobColours(both), [A, A, A, off, B, B, off, off]);
  assert.deepEqual(M.knobColours({}), new Array(8).fill(off), 'nothing heard: all dark');
  assert.deepEqual(M.knobColours(null), new Array(8).fill(off));
  assert.deepEqual(M.knobColours({ B: { controls: [] } }), new Array(8).fill(off), '27 EQ: no knobs');
  assert.deepEqual(M.knobColours({ A: [{ knob: 1 }, { knob: 9 }, null, { knob: '2' }] }), [A, off, off, off, off, off, off, off], 'bad entries ignored');
  // end to end with the set: Hodge in slot A, Paint Pour in slot B (slot.js numbers them, slot B + 4)
  const SetLib = require('../../../experiments/set.js'), SlotLib = require('../../../experiments/slot.js');
  const SET = JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/set.json'), 'utf8'));
  const by = page => SET.scenes.find(s => s.page === page);
  const lit = M.knobColours({ A: { controls: SlotLib.controls(SET, by('16-hodge-kaleidoscope.html'), 'A') }, B: { controls: SlotLib.controls(SET, by('24-paint-pour.html'), 'B') } });
  assert.deepEqual(lit, [A, A, A, off, B, B, B, off], 'Paint Pour in B: beat 5, pulse 6, tilt 7');
  assert.ok(SetLib.buildUrl(SET, by('24-paint-pour.html')).includes('pulseKnob=2'));
});

test('encoder LEDs on the device: dark on connect, one batch per controls change (only the changed rings), again on replug and after Mode Select, dark on stop', async () => {
  const access = fakeAccess();
  const { ctl, out, clear, inp, advance } = await rig({ access });
  const start = ringSx(out().sent).map(hex);
  assert.deepEqual(start, [13, 14, 15, 16, 17, 18, 19, 20].map(cc => ring(cc, [0, 0, 0])), 'connect: all 8 rings dark, after DAW mode');
  assert.deepEqual(out().sent.slice(0, 3).map(hex), ['9f 0c 7f', 'b7 1e 00', 'f0 00 20 29 02 15 04 35 01 f7'], 'DAW mode and the display first');
  const { A, B, off } = M.MAP.KNOB_RGB;
  const both = { A: { controls: [{ knob: 1, name: 'beat' }, { knob: 2, name: 'dive' }, { knob: 3, name: 'glint' }] }, B: { controls: [{ knob: 5, name: 'beat' }, { knob: 6, name: 'pulse' }] } };
  clear();
  assert.equal(ctl.setControls(both), 5);
  assert.deepEqual(encSx(out().sent).map(hex), [ring(13, A), ring(14, A), ring(15, A), ring(17, B), ring(18, B)], 'only the 5 rings that changed');
  assert.equal(ctl.ledBatches, 2, 'one batch on connect, one for this change');
  clear();
  assert.equal(ctl.setControls(both), 0, 'the same controls again: nothing');
  for (let i = 0; i < 10; i++) { advance(50); ctl.tick(); }
  assert.deepEqual(encSx(out().sent), [], 'nothing per frame');
  // slot B goes to EQ Calibrate (no knobs): its two rings go dark
  clear();
  assert.equal(ctl.setControls({ A: both.A, B: { controls: [] } }), 2);
  assert.deepEqual(encSx(out().sent).map(hex), [ring(17, off), ring(18, off)]);
  // replug: DAW mode again and every ring with the current colours
  unplug(access); plug(access);
  assert.deepEqual(ringSx(out().sent).map(hex), [A, A, A, off, off, off, off, off].map((c, i) => ring(13 + i, c)));
  // the Mode Select page: the next tick sends the rings again (once)
  clear(); inp().onmidimessage({ data: [0xB6, 30, 0x16] }); ctl.tick();
  assert.equal(ringSx(out().sent).length, 8);
  clear(); ctl.tick();
  assert.equal(encSx(out().sent).length, 0);
  // stop: the rings dark, DAW mode off last
  clear(); ctl.stop();
  const s = out().sent.map(hex);
  for (let cc = 13; cc <= 20; cc++) assert.ok(s.includes(ring(cc, off)), `ring ${cc} dark`);
  assert.equal(s[s.length - 1], '9f 0c 00');
});

test('scene-change buttons purple: upper 3/4/7/8 (CC 39/40/43/44) with the ring SysEx, in the rings\' batch (connect, replug, Mode Select), never per frame, dark on stop', async () => {
  assert.deepEqual(M.MAP.SLOT_BUTTON_CCS, [39, 40, 43, 44]);
  assert.deepEqual(M.MAP.SLOT_BUTTON_CCS, Object.keys(M.MAP.SLOT_CCS).map(Number).sort((a, b) => a - b), 'the slot buttons, from SLOT_CCS');
  assert.deepEqual(M.MAP.SLOT_BUTTON_RGB, [100, 0, 127]);
  assert.equal(hex(M.encoderLed(39, M.MAP.SLOT_BUTTON_RGB)), 'f0 00 20 29 02 15 01 53 27 64 00 7f f7');
  assert.equal(MAP.encoders.ledRgb.verified.startsWith('hardware 20 Nov'), true, 'the rings, checked on the Mac');
  const purple = cc => ring(cc, M.MAP.SLOT_BUTTON_RGB);
  const btnSx = sent => encSx(sent).filter(b => [39, 40, 43, 44].includes(b[8])).map(hex);
  const access = fakeAccess();
  const { ctl, out, clear, inp, advance } = await rig({ access });
  assert.deepEqual(btnSx(out().sent), [39, 40, 43, 44].map(purple), 'connect: the 4 buttons purple, after the 8 rings');
  const sx = encSx(out().sent).map(b => b[8]);
  assert.deepEqual(sx, [13, 14, 15, 16, 17, 18, 19, 20, 39, 40, 43, 44], 'one batch: rings, then buttons');
  // controls changes and frames: the buttons are not sent again
  clear();
  ctl.setControls({ A: { controls: [{ knob: 1, name: 'beat' }] } });
  for (let i = 0; i < 10; i++) { advance(50); ctl.tick(); }
  assert.deepEqual(btnSx(out().sent), [], 'not per change, not per frame');
  // no other upper-row LED is touched: hold / auto-hold keep their palette CCs, 41 / 42 stay dark
  assert.ok(!out().sent.some(b => b[0] === 0xB0 && [39, 40, 41, 42, 43, 44].includes(b[1])), 'no palette CC on the slot or audition buttons');
  // replug and Mode Select: purple again, once
  unplug(access); plug(access);
  assert.deepEqual(btnSx(out().sent), [39, 40, 43, 44].map(purple));
  clear(); inp().onmidimessage({ data: [0xB6, 30, 0x16] }); ctl.tick();
  assert.deepEqual(btnSx(out().sent), [39, 40, 43, 44].map(purple));
  clear(); ctl.tick();
  assert.deepEqual(btnSx(out().sent), []);
  // stop: dark, DAW mode off last
  clear(); ctl.stop();
  const s = out().sent.map(hex);
  for (const cc of [39, 40, 43, 44]) assert.ok(s.includes(ring(cc, [0, 0, 0])), `button ${cc} dark`);
  assert.equal(s[s.length - 1], '9f 0c 00');
  // no SysEx: no purple bytes, the slot buttons still step the slots
  const calls = [];
  const plain = await rig({ sysex: false, onSlot: (sl, d) => calls.push([sl, d]), log: () => {} });
  assert.deepEqual(encSx(plain.out().sent), []);
  plain.inp().onmidimessage({ data: [0xB0, 40, 127], timeStamp: 1 });
  assert.deepEqual(calls, [['A', 1]]);
});

test('encoder LEDs never block: no SysEx or a send that throws is logged once; the knobs, the buttons and the clock carry on', async () => {
  const logs = [], knobs = [];
  const plain = await rig({ sysex: false, log: m => logs.push(m), onKnob: (n, v) => knobs.push([n, v]) });
  const both = { A: { controls: [{ knob: 1, name: 'beat' }] }, B: { controls: [{ knob: 5, name: 'beat' }] } };
  assert.equal(plain.ctl.setControls(both), 0);
  plain.ctl.setControls(both); plain.ctl.tick();
  assert.equal(plain.out().sent.filter(b => b[0] === 0xF0).length, 0, 'no SysEx bytes');
  assert.equal(logs.length, 1, 'logged once'); assert.match(logs[0], /SysEx/);
  plain.inp().onmidimessage({ data: [0xBF, 13, 127] });
  assert.deepEqual(knobs, [[1, 1]], 'the knob still reaches the page');
  // a port whose SysEx send throws
  const logs2 = [];
  const r = await rig({ log: m => logs2.push(m) });
  const port = r.out(), real = port.send.bind(port);
  let throws = 0;
  port.send = (b, at) => { if (b[0] === 0xF0) { throws++; throw new Error('port gone'); } return real(b, at); };
  assert.doesNotThrow(() => r.ctl.setControls(both));
  assert.equal(r.ctl.ledError, 'port gone');
  for (let i = 0; i < 5; i++) { r.advance(50); r.ctl.tick(); }
  r.ctl.setControls({ A: { controls: [] } });
  assert.equal(logs2.length, 1, 'logged once');
  assert.ok(throws <= 2 + 5 * 2, `no LED retry per frame (${throws} SysEx attempts, the display's included)`);
  r.press(45, 127, 9); r.press(45, 0, 10);
  assert.deepEqual(r.clock.fixes.map(f => f.kind), ['tap'], 'the buttons still fix the clock');
});

test('the conductor hands the controls to the controller: on each controls message and once the controller exists', () => {
  const html = fs.readFileSync(path.join(REPO, 'experiments/clock-conductor.html'), 'utf8');
  assert.match(html, /const pushLeds = \(\) => \{ if \(!ledsOn\) return; try \{ controller\.setControls\(slotControls\); \} catch \(e\)/);
  assert.match(html, /slotControls\[c\.slot\] = c;\s*showControls\(\);\s*pushLeds\(\);/);
  assert.match(html, /ledsOn = true; pushLeds\(\);[^\n]*\ncontroller\.start\(\)/);
  assert.ok(html.indexOf('ledsOn = true; pushLeds();') > html.indexOf('const controller = MidiController.create('), 'after the controller exists');
});
