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
function fakeAccess({ sysex = true, withDevice = true } = {}) {
  const a = { sysexEnabled: sysex, inputs: new Map(), outputs: new Map(), onstatechange: null };
  if (withDevice) plug(a);
  return a;
}
function plug(a) {
  a.inputs.set('in-midi', port('LCXL3 1 MIDI Out', 'input')); a.inputs.set('in-daw', port('LCXL3 1 DAW Out', 'input'));
  a.outputs.set('out-midi', port('LCXL3 1 MIDI In', 'output')); a.outputs.set('out-daw', port('LCXL3 1 DAW In', 'output'));
  if (a.onstatechange) a.onstatechange({});
}
function unplug(a) {
  for (const m of [a.inputs, a.outputs]) for (const p of m.values()) p.state = 'disconnected';
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
  const ctl = M.create({ clock, navigator: nav, perfNow: () => now, lastFix: () => o.lastFix || '',
    setInterval: () => 1, clearInterval: () => {}, setTimeout: (f, ms) => { timers.push({ f, at: now + ms }); return timers.length; },
    clearTimeout: h => { timers[h - 1] = null; }, onStatus: s => statuses.push(s) });
  clock.nowRef = () => now;
  await ctl.start();
  const out = () => access.outputs.get('out-daw'), inp = () => access.inputs.get('in-daw');
  const press = (cc, v = 127, ts = 5) => inp().onmidimessage({ data: [0xB0, cc, v], timeStamp: ts });
  const advance = ms => { now += ms; for (const t of timers) if (t && t.at <= now) { t.f(); timers[timers.indexOf(t)] = null; } };
  return { access, clock, ctl, out, inp, press, advance, statuses, now: () => now, clear: () => { out().sent.length = 0; out().at.length = 0; } };
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

test('the upper row, the pots, the faders and Shift move nothing', async () => {
  const { clock, inp } = await rig();
  for (let cc = 37; cc <= 44; cc++) inp().onmidimessage({ data: [0xB0, cc, 127] });
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
