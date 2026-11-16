// The conductor's "Corrections now" panel (the user, 17 Nov 00:47): experiments/corrections.mjs fed a fix sequence
// (the page's fix results and clock.jumps entries) and the clock's state, the text it shows, the status of each fix;
// clock.js's read-only handState getter; the page's wiring (at most 4 updates a second). No browser.
//   node --test qa/runner/test/corrections.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as K from '../../../experiments/corrections.mjs';
import * as C from '../../../experiments/conductor.mjs';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const trackAt = t => t * 1000;   // the track started at clock time 0
const statusOf = corr => Object.fromEntries(corr.history().map(r => [r.label, r.status]));
const tapJ = (extra = {}) => ({ type: 'jump', kind: 'tap', fromBeats: 1, toBeats: 1, ...extra });

test('corrections: tap 4x, x2, nudge +10 x3, flip, a tracker override, restart -> the lines and the status of each fix', () => {
  const corr = K.createCorrections();
  // 4 taps in one run: one row; the 4th sets the tempo
  for (const t of [10, 10.5, 11]) corr.fix({ kind: 'tap', j: tapJ(), at: t, ms: trackAt(t), bpmBefore: 126.4, bpmAfter: 126.4 });
  assert.equal(corr.history().length, 1, 'the taps of one run are one row');
  assert.equal(corr.history()[0].effect, 'beat moved to the tap (3 taps)');
  corr.fix({ kind: 'tap', j: tapJ({ taps: 4, tapBpm: 120 }), at: 11.5, ms: trackAt(11.5), bpmBefore: 126.4, bpmAfter: 120 });
  assert.equal(corr.history()[0].effect, 'tempo 126.4 -> 120.0 (4 taps)');
  corr.fix({ kind: 'x2', j: { type: 'jump', kind: 'x2', fromBeats: 40, toBeats: 40 }, at: 20, ms: 20000, bpmBefore: 120, bpmAfter: 240 });
  for (const t of [30, 30.2, 30.4]) corr.fix({ kind: 'nudge', arg: 10, j: { type: 'jump', kind: 'nudge' }, at: t, ms: trackAt(t) });
  corr.fix({ kind: 'flip', j: { type: 'flip-scheduled', kind: 'flip', atBeats: 164 }, at: 40, ms: 40000 });
  corr.jump({ type: 'jump', kind: 'flip', origin: 'fix:key', at: 41 }, 41000);   // the flip lands at the bar line
  assert.deepEqual(statusOf(corr), { tap: 'active', x2: 'active', nudge: 'active', flip: 'active' });
  assert.deepEqual(corr.history().map(r => r.effect), ['half a beat at the next bar line', '+10 ms x3 = +30 ms', 'tempo 120.0 -> 240.0, octave held', 'tempo 126.4 -> 120.0 (4 taps)']);

  const ts = { state: 'locked', bpm: 240, tapped: true, octaveLock: 240, offsetBeats: 12.12, lane: { side: { offset: 0.5 } },
    held: { on: false, recentreArmed: true }, hold: { releases: [] } };
  const hand = { octaveHold: { kind: 'x2', at: 20, origin: 'fix:key' }, holdRelease: null, flipDue: false, oneAt: 0, taps: 0 };
  const view = { ts, hand, autoHold: false, nowMs: 45000, trackAt, hasBeats: true };
  assert.deepEqual(corr.nowLines(view), [
    'tempo   tap: 4 taps, 240.0 bpm since 00:45',
    'octave  x2 at 240.0 bpm since 00:45; to release: press x2 again (Shift+D)',
    'side    flipped (1/2 beat) since 00:45; hand flips since restart: 1',
    'nudge   +30 ms since 00:45 (a tap or restart clears it)',
    'bar 1   the clock\'s own count (no set 1)',
    'hold    off; auto-hold off',
    'tracker took over: none']);
  // the since times stay while the values stay
  assert.equal(corr.nowLines({ ...view, nowMs: 47000 })[0], 'tempo   tap: 4 taps, 240.0 bpm since 00:45');

  // the tracker overrides the tap (its own model disagreed for > 4 s): the tap is taken back, x2 / nudge / flip stay
  corr.jump({ type: 'jump', kind: 'override', origin: 'tracker', at: 50 }, 50000);
  assert.deepEqual(statusOf(corr), { tap: 'taken back by the tracker', x2: 'active', nudge: 'active', flip: 'active' });
  const after = corr.nowLines({ ...view, ts: { ...ts, tapped: false }, nowMs: 52000 });
  assert.equal(after[0], 'tempo   tracker 240.0 bpm since 00:52');
  assert.equal(after[6], 'tracker took over at 00:50: override replaced the tap tempo 120.0 bpm');

  // restart: everything active is cleared; the flips count again from 0
  corr.fix({ kind: 'restart', j: { type: 'restart', kind: 'restart', at: 60 }, at: 60, ms: 60000 });
  assert.deepEqual(corr.history().map(r => [r.label, r.status]), [
    ['restart', 'active'], ['flip', 'cleared by restart'], ['nudge', 'cleared by restart'], ['x2', 'cleared by restart'], ['tap', 'taken back by the tracker']]);
  assert.equal(corr.flips, 0);
  const text = corr.text({ ts: { state: 'acquire', bpm: 0, tapped: false, octaveLock: null, offsetBeats: 0, lane: { side: { offset: 0 } }, held: { on: false }, hold: { releases: [] } },
    hand: { octaveHold: null, holdRelease: null, flipDue: false }, autoHold: false, nowMs: 61000, trackAt, hasBeats: false });
  const lines = text.split('\n');
  assert.ok(lines.length <= 7 + 1 + K.HISTORY_ROWS, `${lines.length} lines`);
  assert.deepEqual(lines.slice(1, 5), ['octave  off', 'side    on the beat since 01:01; hand flips since restart: 0', 'nudge   0 ms', 'bar 1   none (no beat yet)']);
  assert.equal(lines[6], 'tracker took over at 00:50: override replaced the tap tempo 120.0 bpm', 'the last take-over stays shown');
  assert.equal(lines[7], 'last fixes (newest first):');
  assert.equal(lines[8], '01:00 restart: a fresh tracker: tempo, octave, side, nudge and bar 1 start over [active]');
  assert.equal(lines[12], '00:11 tap: tempo 126.4 -> 120.0 (4 taps) [taken back by the tracker]');
  assert.ok(/^[\x20-\x7e\n]*$/.test(text), 'plain ASCII (#205)');
});

test('corrections: the tracker lets an x2 go, a /2 released by hand, hold and SUSPECT, set 1 and reset, a tap clears the nudge, unknowns', () => {
  const corr = K.createCorrections();
  corr.fix({ kind: 'x2', j: { type: 'jump', kind: 'x2' }, at: 5, ms: 5000, bpmBefore: 100, bpmAfter: 200 });
  const rel = { hold: { releases: [{ t: 9, why: 'evidence', lock: 200, raw: 100 }] } };
  corr.observe({ ts: rel, trackAt });
  corr.observe({ ts: rel, trackAt });   // the same release once only
  assert.equal(statusOf(corr).x2, 'taken back by the tracker');
  assert.deepEqual(corr.takeover, { ms: 9000, text: 'octave release (evidence) replaced the x2 hold' });
  // /2, then /2 again: the second press releases it at the bar line
  corr.fix({ kind: 'half', j: { type: 'jump', kind: 'half' }, at: 12, ms: 12000, bpmBefore: 100, bpmAfter: 50 });
  corr.fix({ kind: 'half', j: { type: 'release-scheduled', kind: 'half', atBeats: 32 }, at: 13, ms: 13000 });
  assert.deepEqual(statusOf(corr), { x2: 'taken back by the tracker', '/2': 'released', '/2 again': 'active' });
  const ts = { bpm: 50, tapped: false, octaveLock: 50, offsetBeats: 0, lane: { side: { offset: 0 } }, held: { on: false }, hold: { releases: rel.hold.releases } };
  assert.equal(corr.nowLines({ ts, hand: { octaveHold: { kind: 'half' }, holdRelease: { kind: 'half' } }, nowMs: 13000, trackAt, hasBeats: true })[1],
    'octave  /2 at 50.0 bpm since 00:13; release booked for the next bar line');
  assert.match(corr.nowLines({ ts, hand: null, nowMs: 13000, trackAt, hasBeats: true })[1], /^octave  unknown at 50\.0 bpm/, 'no handState: the key is unknown');
  // hold on, SUSPECT; hold off releases it
  corr.fix({ kind: 'hold', j: { type: 'fix', kind: 'hold', on: true }, at: 30, ms: 30000, bpmAfter: 128 });
  const held = { ...ts, octaveLock: null, held: { on: true, since: 30, bpm: 128, suspect: true, suspectWhy: 'tempo', suspectSince: 35, recentreArmed: false } };
  const hl = corr.nowLines({ ts: held, hand: null, autoHold: true, nowMs: 36000, trackAt, hasBeats: true });
  assert.equal(hl[0], 'tempo   held 128.0 bpm since 00:36');
  assert.equal(hl[5], 'hold    on since 00:30 at 128.0 bpm; auto-hold on; re-centre used; SUSPECT (tempo) since 00:35');
  corr.fix({ kind: 'hold', j: { type: 'fix', kind: 'hold', on: false }, at: 40, ms: 40000 });
  assert.equal(statusOf(corr)['hold on'], 'released');
  // set 1, then reset replaces it; the bar line names the hand fix
  corr.fix({ kind: 'setOne', j: { type: 'jump', kind: 'setOne', fromBeats: 64.2, toBeats: 64.2 }, at: 70, ms: 70000 });
  assert.equal(corr.history()[0].effect, 'bar 1 on this beat (beat 64)');
  assert.equal(corr.nowLines({ ts, hand: null, nowMs: 71000, trackAt, hasBeats: true })[4], 'bar 1   by hand (set 1) at 01:10');
  corr.fix({ kind: 'reset', j: { type: 'jump', kind: 'reset' }, at: 75, ms: 75000 });
  assert.equal(statusOf(corr)['set 1'], 'replaced by a newer fix');
  // a nudge, then one tap (beat only): the tap rounds the offset, so the nudge is replaced
  corr.fix({ kind: 'nudge', arg: -10, j: { type: 'jump', kind: 'nudge' }, at: 80, ms: 80000 });
  corr.fix({ kind: 'nudge', arg: 10, j: { type: 'jump', kind: 'nudge' }, at: 81, ms: 81000 });
  assert.equal(corr.history().filter(r => r.label === 'nudge').length, 2, 'a press the other way is its own row');
  corr.fix({ kind: 'tap', j: tapJ(), at: 85, ms: 85000, bpmBefore: 50 });
  assert.deepEqual(corr.history().slice(0, 3).map(r => [r.label, r.effect, r.status]), [
    ['tap', 'beat moved to the tap (1 tap)', 'active'], ['nudge', '+10 ms', 'replaced by a newer fix'], ['nudge', '-10 ms', 'replaced by a newer fix']]);
  // a rejected tap and a refused fix change nothing
  corr.fix({ kind: 'tap', j: { type: 'fix', kind: 'tap', rejected: 'uneven', tapError: 'double', spreadPct: 40 }, at: 90, ms: 90000 });
  corr.fix({ kind: 'flip', j: null, at: 91, ms: 91000 });
  assert.deepEqual(corr.history().slice(0, 2).map(r => [r.label, r.effect, r.status]), [['flip', 'no effect', 'no effect'], ['tap', 'rejected: double tap, nothing changed', 'no effect']]);
  assert.equal(corr.history().length, K.HISTORY_ROWS, 'the last 8 only');
  corr.fix({ kind: 'autoHold', j: { type: 'setting', on: true }, at: 92, ms: 92000 });
  assert.equal(corr.history()[0].label, 'flip', 'auto-hold is a setting, not a fix row');
  // nothing exposed: unknown
  assert.deepEqual(corr.nowLines({ ts: null }).map(l => l.endsWith('unknown')), [true, true, true, true, true, true, true]);
  assert.equal(K.nudgeMs(2, 120), 0); assert.equal(K.nudgeMs(-0.04, 120), -20); assert.equal(K.nudgeMs(1, 0), 0, 'whole beats: no nudge at any tempo'); assert.equal(K.nudgeMs(1.5, 0), null);
  assert.equal(K.mmss(65000), '01:05'); assert.equal(K.mmss(null), '--:--'); assert.equal(K.mmss(-5), '00:00');
});

test('corrections on the page: clock.handState is a read-only copy (null off line); the panel is wired at most 4 times a second; guide line', () => {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const ctx = { currentTime: 0, sampleRate: 48000, outputLatency: 0, baseLatency: 0, destination: { connect() {} }, resume() {},
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createOscillator: () => ({ frequency: param(), connect() {}, start() {}, stop() {} }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
    createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, connect() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }) };
  const P = 0.5, tr = { jumps: [], state: 'locked', confidence: 0.9, hasModel: true, octaveLock: null, scheduled: null, bpm: 120, push() {},
    beatsAt: t => t / P, timeOf: b => b * P, tap() {}, scaleTempo(f) { this.octaveLock = 120 * f; },
    snapshot() { return { state: 'locked', confidence: 0.9, octaveLock: this.octaveLock, bpm: 120, tapped: false, lastJump: null }; } };
  const c = Clock.create({ source: 'line', settings: { bpm: 120, bpb: 4, muted: true, kick: C.KICK_QUARTERS, snare: C.SILENT, hat: C.SILENT },
    audioContext: () => ctx, timers: false, pump: true, tracker: tr, lineFeed: true, keys: false });
  c.start();
  ctx.currentTime = 1; c.lineFrame({ t: 1, flux: 0 });
  assert.deepEqual(c.handState, { octaveHold: null, holdRelease: null, flipDue: false, oneAt: 0, taps: 0 });
  c.fix('x2', undefined, { origin: 'qa' });
  const hs = c.handState;
  assert.equal(hs.octaveHold.kind, 'x2');
  hs.octaveHold.kind = 'half';
  assert.equal(c.handState.octaveHold.kind, 'x2', 'a copy: changing it changes nothing in the clock');
  const r = c.fix('x2', undefined, { origin: 'qa' });   // the second press books the release
  assert.equal(r.type, 'release-scheduled');
  assert.equal(c.handState.holdRelease.kind, 'x2');
  tr.scheduled = { kind: 'flip', atBeat: 8 };
  assert.equal(c.handState.flipDue, true);
  assert.equal(Clock.create({ source: 'metronome', audioContext: () => ctx, timers: false, keys: false }).handState, null);

  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  assert.match(html, /import \{ createCorrections, PANEL_HZ \} from '\.\/corrections\.mjs';/);
  assert.match(html, /<div class="corrBox"><small>Corrections now<\/small><div id="corrections">-<\/div><\/div>/);
  assert.match(html, /if \(now - corrAt >= 1 \/ PANEL_HZ\) \{/, 'throttled');
  assert.match(html, /setText\('corrections', corr\.text\(\{ ts, hand: clock\.handState,/, 'text set only when it changes (setText)');
  assert.match(html, /corr\.jump\(j, trackAt\(j\.at\)\);/, 'fed from the jump loop the log already reads');
  assert.match(html, /corr\.fix\(\{ kind, arg, j, at: ctx\.currentTime,/, 'fed from the fix wrapper the log already reads');
  assert.equal(K.PANEL_HZ, 4);
  const mod = fs.readFileSync(path.join(REPO, 'experiments', 'corrections.mjs'), 'utf8');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(mod), 'corrections.mjs plain ASCII');
  assert.doesNotMatch(mod, /clock\.fix\(|log\.add\(/, 'display only: no fix, no log record');
  const guide = fs.readFileSync(path.join(REPO, 'qa', 'CONDUCTOR_GUIDE.md'), 'utf8');
  const read = guide.slice(guide.indexOf('## Read the clock'), guide.indexOf('## Fix the clock'));
  assert.match(read, /- Corrections now \(under "last fix"\): one line each for tempo, octave, side, nudge, bar 1, hold and the tracker/);
});
