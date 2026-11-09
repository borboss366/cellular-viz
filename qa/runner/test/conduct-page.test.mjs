// The conductor page (#188 Task 1, experiments/clock-conductor.html): clock.js's read-only tracker tee for the shadow
// (R3), the page's pure parts (experiments/conductor.mjs: decks, crossfade, shadow beats, bar lamp, calibrate, keys),
// the server's mark names and 64 KB line limit (R9), marks-apply's barOk report (A7b), and the page's inline module
// (its imports are served, its syntax compiles). No browser here; the headless smoke run is separate.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as C from '../../../experiments/conductor.mjs';
import * as S from '../../conduct-serve.mjs';
import * as A from '../../marks-apply.mjs';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  return { currentTime: 0, sampleRate: 48000, outputLatency: 0, baseLatency: 0, destination: { connect() {} }, resume() {},
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createOscillator: () => ({ frequency: param(), connect() {}, start() {}, stop() {} }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
    createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, connect() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }) };
}
function stubTracker(bpm, seen) {
  const P = 60 / bpm;
  return { jumps: [], state: 'locked', confidence: 0.9, hasModel: true, get bpm() { return bpm; }, push(f) { seen.push(['tracker', f.t]); },
    beatsAt: t => t / P, timeOf: b => b * P, tap() {}, scaleTempo() { seen.push(['scale']); },
    snapshot() { return { state: 'locked', confidence: 0.9, octaveLock: null, bpm, tapped: false, lastJump: null }; } };
}

test('clock.onTrackerFrame (R3): every frame the tracker gets, in order, after it; unsubscribe; a throwing listener harms nothing; null off line', () => {
  const seen = [], ctx = fakeContext();
  const c = Clock.create({ source: 'line', settings: { bpm: 120, bpb: 4, muted: true, kick: C.KICK_QUARTERS, snare: C.SILENT, hat: C.SILENT },
    audioContext: () => ctx, timers: false, pump: true, tracker: stubTracker(120, seen), lineFeed: true, keys: false });
  c.start();
  const off = c.onTrackerFrame(f => seen.push(['tee', f.t]));
  c.onTrackerFrame(() => { throw new Error('boom'); });
  for (const t of [0.01, 0.02, 0.03]) { ctx.currentTime = t; c.lineFrame({ t, flux: 0 }); }
  off();
  ctx.currentTime = 0.04; c.lineFrame({ t: 0.04, flux: 0 });
  assert.deepEqual(seen, [['tracker', 0.01], ['tee', 0.01], ['tracker', 0.02], ['tee', 0.02], ['tracker', 0.03], ['tee', 0.03], ['tracker', 0.04]]);
  c.fix('x2', undefined, { origin: 'qa' });
  assert.deepEqual(seen.at(-1), ['scale'], 'fixes reach the clock\'s tracker only: the tee hands out frames, nothing else');
  assert.equal(Clock.create({ source: 'metronome', audioContext: fakeContext, timers: false, keys: false }).onTrackerFrame(() => {}), null);
});

test('conductor.mjs: deck positions, equal-power fade, shadow beats once each, the bar lamp on a "1"', () => {
  const d = { at: 10, offsetS: 30 };
  assert.equal(C.deckPosMs(d, 12.5), 32500);
  assert.equal(C.deckCtxAt(d, 32500), 12.5);
  for (const x of [0, 0.3, 0.5, 1]) { const [a, b] = C.xfadeGains(x); assert.ok(Math.abs(a * a + b * b - 1) < 1e-12); }
  assert.deepEqual(C.xfadeGains(0).map(v => Math.round(v * 1e9) / 1e9), [1, 0]);
  const count = C.beatCounter(), beatsAt = t => (t - 1) * 2, timeOf = b => 1 + b / 2;   // 120 BPM from t = 1 s
  assert.deepEqual(count(beatsAt, timeOf, 0.5), [], 'no model yet');
  assert.deepEqual(count(beatsAt, timeOf, 1.2), [], 'the first call only starts counting');
  assert.deepEqual(count(beatsAt, timeOf, 2.6), [1.5, 2, 2.5]);
  assert.deepEqual(count(beatsAt, timeOf, 2.7), [], 'never twice');
  const beats = [{ ms: 500, pos: 4 }, { ms: 1000, pos: 1 }, { ms: 1500, pos: 2 }];
  assert.deepEqual(C.barLamp(beats, 1050), { on: true, beat: 1 });
  assert.equal(C.barLamp(beats, 1200).on, false, 'too far from the 1');
  assert.equal(C.barLamp(beats, 1500).on, false, 'beat 2');
  assert.equal(C.barLamp([], 1000).on, false);
});

test('conductor.mjs: calibrate steps accelerate and clamp (R10); venue profiles round-trip, bad files refused', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 20].map(C.calStep), [1, 1, 2, 2, 4, 4, 8, 8, 10, 10]);
  assert.deepEqual([C.clampOffset(-500), C.clampOffset(250), C.clampOffset('12.4')], [-100, 200, 12]);
  const p = { club: { offsetMs: 35 }, 'home desk': { offsetMs: -4 } };
  assert.deepEqual(C.importProfiles(C.exportProfiles(p)), p);
  assert.throws(() => C.importProfiles('{"profiles":{}}'), /version 1/);
  assert.throws(() => C.importProfiles(JSON.stringify({ version: 1, profiles: { x: { offsetMs: 'a' } } })), /profile x/);
  assert.equal(C.importProfiles(JSON.stringify({ version: 1, profiles: { far: { offsetMs: 999 } } })).far.offsetMs, 200);
});

test('conductor.mjs pageKey: M [ ] Shift+S Space N K Alt+,/. are the page\'s; Shift + the clock\'s keys and typing are not', () => {
  const k = (code, mods = {}) => C.pageKey({ code, target: { tagName: 'BODY' }, ...mods });
  assert.deepEqual([k('KeyM'), k('BracketLeft'), k('BracketRight'), k('KeyS', { shiftKey: true }), k('Space'), k('KeyN'), k('KeyK')].map(a => a && a.type),
    ['mark', 'step', 'step', 'barOk', 'playPause', 'next', 'keyLamp']);
  assert.deepEqual([k('BracketLeft').delta, k('BracketRight').delta], [-1, 1]);
  assert.deepEqual([k('Comma', { altKey: true }).dir, k('Period', { altKey: true, repeat: true }).dir], [-1, 1], 'Alt held repeats (acceleration)');
  for (const x of [k('KeyA', { shiftKey: true }), k('Digit1', { shiftKey: true }), k('Comma', { shiftKey: true }), k('KeyM', { ctrlKey: true }), k('KeyM', { repeat: true }), k('KeyS')]) assert.equal(x, null);
  assert.equal(C.pageKey({ code: 'KeyM', target: { tagName: 'INPUT', type: 'text' } }), null, 'typing a venue name');
});

test('conduct-serve: mark names from corpus.json in /api/tracks, a line over 64 KB refused (R9); marks-apply reports barOk, never writes it to corpus', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conduct-page-')), tracks = path.join(root, 'tracks');
  fs.mkdirSync(tracks);
  fs.writeFileSync(path.join(tracks, 'some-stem.flac'), Buffer.alloc(16));
  fs.writeFileSync(path.join(root, 'corpus-map.json'), JSON.stringify({ version: 1, tracks: { 'one-more-time': 'some-stem' } }));
  const srv = http.createServer(S.createHandler({ tracksDir: tracks, sessionsDir: path.join(root, 'sessions') }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const [t] = await (await fetch(`${base}/api/tracks`)).json();
    assert.deepEqual([t.id, t.marks], ['one-more-time', ['breakdownIn', 'kickBack']]);
    const big = JSON.stringify({ type: 'key', ctx: 1, shown: false, pad: 'x'.repeat(70000) });
    const r = await fetch(`${base}/log/conductor-20261109-170000`, { method: 'POST', body: big + '\n' });
    assert.equal(r.status, 400);
    assert.match((await r.json()).lines[0], /over 64 KB/);
    assert.equal((await fetch(`${base}/experiments/conductor.mjs`)).status, 200, 'the page\'s module is served');
  } finally { await new Promise(r => srv.close(r)); fs.rmSync(root, { recursive: true, force: true }); }
  const marks = [{ id: 'opus', name: 'barOk', beat: 96, atMs: 45000, rawMs: 45020, markSource: 'key' }];
  const text = fs.readFileSync(path.join(REPO, 'qa', 'corpus.json'), 'utf8');
  const c = A.applyToCorpus(text, marks);
  assert.equal(c.text, text, 'barOk never goes to corpus.json');
  assert.deepEqual(A.barOkLines(marks), ['grid opus: barOk confirmed with Shift+S on beat 96 (set barOk: true in its sidecar on the box)']);
});

test('clock-conductor.html: its module imports are files the server serves, the inline module compiles, the scripts it loads exist', () => {
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const imports = [...mod.matchAll(/from '([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(imports.sort(), ['../qa/conduct-log.mjs', '../qa/marks.mjs', './conductor.mjs']);
  for (const i of imports) {
    if (i.startsWith('../qa/')) assert.ok(S.BROWSER_MODULES.includes(path.basename(i)), `${i} is served`);
    assert.ok(fs.existsSync(path.join(REPO, 'experiments', i)), `${i} exists`);
  }
  for (const s of [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1])) assert.ok(fs.existsSync(path.join(REPO, 'experiments', s)), s);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conduct-html-')), f = path.join(tmp, 'page.mjs');
  try {
    fs.writeFileSync(f, mod);
    execFileSync(process.execPath, ['--check', f], { encoding: 'utf8' });   // throws with the syntax error
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  for (const id of ['lampBeat', 'lampKick', 'lampBar', 'bpmShadow', 'offset', 'profiles', 'markName']) assert.ok(html.includes(`id="${id}"`), id);
});

test('clock-conductor.html Help: a Help button and a hidden panel with the guide steps, ? toggles it, plain ASCII only (#205 font rule)', () => {
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  const btn = /<button id="help"[^>]*>([^<]*)<\/button>/.exec(html);
  assert.ok(btn, 'a Help button in the header');
  assert.equal(btn[1], 'Help');
  const panel = /<div id="helpPanel" hidden>([\s\S]*?)<\/div>/.exec(html);
  assert.ok(panel, 'the panel starts hidden');
  for (const s of ['Load to NEXT', 'Play / pause', 'Crossfade', 'Shift+F', 'Shift+S', 'Download log']) assert.ok(panel[1].includes(s), s);
  assert.ok(/^[\x20-\x7e\n\t]*$/.test(btn[0] + panel[1]), 'no glyph outside ASCII in the new labels');
  assert.match(html, /\$\('help'\)\.onclick = toggleHelp/);
  assert.match(html, /a\.type === 'help'\) toggleHelp\(\)/);
  const k = C.pageKey({ key: '?', code: 'Slash', shiftKey: true, target: { tagName: 'BODY' } });
  assert.equal(k && k.type, 'help');
  assert.equal(C.pageKey({ key: '?', code: 'Slash', shiftKey: true, target: { tagName: 'INPUT', type: 'text' } }), null, 'typing a ? in the venue name');
  assert.ok(fs.existsSync(path.join(REPO, 'qa', 'CONDUCTOR_GUIDE.md')), 'the full guide');
});

test('clock-conductor.html layout: long text cannot widen a column or push the header buttons away', () => {
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(css, /main\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/, 'columns may shrink below their content');
  assert.match(css, /section\{[^}]*min-width:0/);
  assert.match(css, /\.banner,\.badge\{[^}]*max-width:22ch[^}]*white-space:nowrap[^}]*overflow:hidden[^}]*text-overflow:ellipsis/, 'badges cut long text');
  assert.match(css, /\.actions\{[^}]*margin-left:auto[^}]*flex:none/, 'the buttons never shrink or wrap away');
  assert.match(css, /\.deck \.name,#msg,#lastFix,#bar1,#tail\{overflow-wrap:anywhere\}/);
  const actions = /<span class="actions">([\s\S]*?)<\/span>/.exec(html);
  assert.ok(actions, 'the header buttons sit in one group');
  for (const id of ['start', 'download', 'help']) assert.ok(actions[1].includes(`id="${id}"`), id);
  for (const id of ['input', 'session', 'scored', 'logState']) assert.match(html, new RegExp(`\\$\\('${id}'\\)\\.textContent = \\$\\('${id}'\\)\\.title =`), `${id} keeps its full text in title`);
});

test('clock-conductor.html band bars: a fixed ASCII label row from Clock.BANDS, built once, the kick label marked', () => {
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  assert.match(html, /<div class="bands" id="bands"><\/div>\s*<div class="bandLabels" id="bandLabels"><\/div>/, 'the labels sit right under the bars');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(css, /\.bandLabels\{display:flex;gap:4px/, 'the same flex and gap as the bars, so each label lines up with its bar');
  assert.match(css, /\.bandLabels>span\{flex:1;min-width:0/);
  const map = /const BAND_LABELS = (\{[^}]*\});/.exec(html);
  assert.ok(map, 'one label per band');
  const labels = Function(`return ${map[1]}`)();
  assert.deepEqual(Clock.BANDS.map(b => labels[b]), ['sub', 'kick', 'low', 'lo-mid', 'mid', 'hi-mid', 'pres', 'air']);
  assert.ok(Object.values(labels).every(s => /^[\x20-\x7e]+$/.test(s)), 'ASCII only (#205)');
  const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  assert.equal((mod.match(/\$\('bandLabels'\)\.innerHTML/g) || []).length, 1, 'built once');
  assert.ok(!/function monitor[\s\S]*bandLabels[\s\S]*function scatter/.test(mod), 'not in the per-frame monitor');
  assert.match(mod, /b === 'kick' \? ' class="k"'/, 'the kick label is marked');
});
