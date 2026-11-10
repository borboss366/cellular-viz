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

test('clock-conductor: a red "Clock is off" banner when the page is not a secure context or the tracker failed; ASCII text', () => {
  assert.equal(C.clockWarning({ secure: true, status: 'listening' }), null, 'localhost / https: no banner');
  assert.equal(C.clockWarning({ secure: true }), null, 'before the audio starts: no banner');
  const lan = C.clockWarning({ secure: false });   // window.isSecureContext stubbed false: http://<LAN address>
  assert.equal(lan, 'Clock is off: this address is not secure. Open http://localhost:8790/ through the ssh tunnel (see Help).');
  assert.equal(C.clockWarning({ secure: false, status: 'error', error: 'AudioWorklet is not available' }), `${lan} (AudioWorklet is not available)`);
  assert.match(C.clockWarning({ secure: true, status: 'error', error: 'boom \u2192 x' }), /^Clock is off: the tracker did not start\. Reload the page\. \(boom \? x\)$/);
  for (const w of [lan, C.clockWarning({ secure: true, status: 'error', error: 'caf\u00e9 \u2014 \u00d7' })]) assert.ok(/^[\x20-\x7e]+$/.test(w), `ASCII (#205): ${w}`);
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  assert.match(html, /<body>\s*<!--[^>]*-->\s*<div id="clockOff" class="clockOff" hidden><\/div>\s*<header>/, 'the banner sits at the top, hidden until needed');
  assert.match(html, /C\.clockWarning\(\{ secure: window\.isSecureContext, status: ts\.status, error: ts\.error \}\)/);
  assert.match(html, /\nshowClockOff\(\);/, 'checked when the page opens, before any audio');
  assert.match(html, /\$\('state'\)\.classList\.toggle\('err', ts\.status === 'error'\)/, 'the State field turns red on error');
  assert.match(html.match(/<style>([\s\S]*?)<\/style>/)[1], /\.err\{color:#ff5a6e/);
});

test('clock-conductor: the band bars are blank without live tracker frames, never full from the all-zero placeholder', () => {
  const B = Clock.BANDS, zeros = Object.fromEntries(B.map(b => [b, 0]));
  assert.deepEqual(C.bandHeights(zeros, B, true), B.map(() => 0), 'the clock reports all 0 before any frame: blank, not 70 px');
  assert.deepEqual(C.bandHeights(undefined, B, true), B.map(() => 0));
  const real = { sub: -20, kick: -10, low: -30, lowMid: -40, mid: -50, upperMid: -60, presence: -70, air: -90 };
  assert.deepEqual(C.bandHeights(real, B, false), B.map(() => 0), 'no frames (status error): blank');
  assert.deepEqual(C.bandHeights(real, B, true), [54, 63, 45, 36, 27, 18, 9, 0]);
  assert.deepEqual(C.bandHeights({ ...real, kick: NaN, air: 5 }, B, true).slice(0, 2), [54, 0], 'NaN draws empty');
  assert.equal(C.bandHeights({ ...real, air: 5 }, B, true)[7], C.BAND_MAX_PX, 'a real loud band still reaches the top');
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  assert.match(html, /const bandsLive = ts\.status === 'listening' && performance\.now\(\) - lastFrameMs < 1000;/);
  assert.match(html, /C\.bandHeights\(r\.bands, Clock\.BANDS, bandsLive\)/);
  assert.ok(!/r\.bands\[b\] \|\| 0\) \+ 80/.test(html), 'the old 0 -> full-height mapping is gone');
});

test('clock-conductor.html: no function shadows the page\'s top-level state (a local `live` read decks[live] in its TDZ, #208)', () => {
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const top = new Set();
  for (const m of mod.matchAll(/^(?:let|const) ([^;=]+(?:=[^;]*)?);/gm)) for (const part of m[1].split(',')) { const n = /^\s*([A-Za-z_$][\w$]*)\s*(=|$)/.exec(part); if (n) top.add(n[1]); }
  for (const name of ['live', 'fade', 'decks', 'tracks', 'clock', 'log']) assert.ok(top.has(name), `${name} is top-level state`);
  const inner = [...mod.matchAll(/^[ \t]+(?:let|const) ([A-Za-z_$][\w$]*)\b/gm)].map(m => m[1]);
  const shadows = inner.filter(n => ['live', 'fade', 'decks', 'tracks', 'clock', 'log', 'shadow', 'ctx'].includes(n));
  assert.deepEqual(shadows, [], `locals shadowing page state: ${shadows.join(', ')}`);
});

test('conductor monitor (9 Nov sitting): the beat side as 0 or 1/2, "octave hold N bpm" only while held and red when far off', () => {
  assert.deepEqual([C.sideText({ offset: 0 }), C.sideText({ offset: 0.5 }), C.sideText(null), C.sideText({ last: { t: 1 } })], ['0', '1/2', '-', '-']);
  const ts = { lane: { lane: 'broad', side: { offset: 0.5, last: { t: 9, phase: 0.1 } } }, octaveLock: 1088.21 };
  const l = C.laneLine(ts, 55.7);
  assert.equal(l.text, 'lane broad . side 1/2 . octave hold 1088 bpm');
  assert.equal(l.warn, true, '1088 against 55.7: red');
  assert.ok(!/object Object/.test(l.text));
  assert.deepEqual(C.laneLine({ ...ts, octaveLock: null }, 136), { text: 'lane broad . side 1/2', warn: false }, 'no hold: no octave text');
  assert.deepEqual(C.octaveText(136, 136.1), { text: 'octave hold 136 bpm', warn: false });
  assert.equal(C.octaveText(272, 136).warn, true, '2x: red');
  assert.equal(C.octaveText(68, 136).warn, true, '0.5x: red');
  assert.equal(C.laneLine({}, 120).text, '');
  for (const s of [l.text, C.laneLine({ lane: { lane: 'low', side: { offset: 0 } } }, 0).text]) assert.ok(/^[\x20-\x7e]*$/.test(s), 'ASCII (#205)');
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  assert.match(html, /const ll = C\.laneLine\(ts, r\.bpm\);/);
  assert.match(html, /\$\('lane'\)\.classList\.toggle\('err', ll\.warn\)/);
  assert.ok(!/side\.last/.test(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]), 'the page no longer prints side.last (an object)');
});

test('conductor decks: an empty deck shows "-", never LIVE; LIVE while playing or as the live deck with a track', () => {
  const deck = (n, o = {}) => ({ n, buffer: null, track: null, playing: false, ...o });
  const full = { buffer: {}, track: { idx: 0 } };
  assert.equal(C.deckTag(deck(0), 0), '-', 'the empty live-index deck before anything plays');
  assert.equal(C.deckTag(deck(1, full), 0), 'NEXT');
  assert.equal(C.deckTag(deck(0, full), 0), 'LIVE');
  assert.equal(C.deckTag(deck(1, { ...full, playing: true }), 0), 'LIVE', 'the outgoing deck still playing in a fade');
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  assert.match(html, /const tag = C\.deckTag\(d, live\);/);
  assert.equal((html.match(/<span class="tag">-<\/span>/g) || []).length, 2, 'both decks start as "-" (ASCII)');
});

test('conductor load(): a failed fetch or decode says "could not load <name>: <reason>" and logs track/loadError', async () => {
  assert.equal(C.loadErrorText('artist-a', new Error('HTTP 404')), 'could not load artist-a: HTTP 404');
  assert.equal(C.loadErrorText('caf\u00e9', { name: 'EncodingError' }), 'could not load caf?: EncodingError');
  assert.equal(C.loadErrorText('x', undefined), 'could not load x: unknown error');
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  const load = html.match(/async function load\(i, d = nextDeck\(\)\) \{([\s\S]*?)\n\}/)[1];
  assert.match(load, /try \{[\s\S]*decodeAudioData[\s\S]*\} catch \(e\) \{/, 'fetch and decode inside try');
  assert.match(load, /if \(!r\.ok\) throw new Error\(`HTTP \$\{r\.status\}`\)/, 'an HTTP error is an error, not a decode of an error page');
  assert.match(load, /C\.loadErrorText\(t\.label, e\)/);
  assert.match(load, /textContent = text; say\(text\);/, 'on the deck line and in the message line');
  assert.match(load, /event: 'loadError'/);
  const { checkRecord } = await import('../../conduct-score.mjs');
  assert.deepEqual(checkRecord({ type: 'track', ctx: 1.5, idx: 0, event: 'loadError', file: 'a', error: 'HTTP 404' }), [], 'the server takes it (schema v1)');
});

test('conductor state line: written once per change, one line each for state and lane (no overlap)', () => {
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  assert.match(mod, /function setText\(id, s\) \{ if \(textCache\[id\] === s\) return;/);
  assert.match(mod, /setText\('state', /);
  assert.match(mod, /setText\('lane', ll\.text\)/);
  assert.ok(!/\$\('(state|lane)'\)\.textContent =/.test(mod), 'no direct per-frame writes left');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(css, /#state,#lane\{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1\.3;min-height:1\.3em\}/);
  assert.match(html, /<div class="stateBox"><small>state<\/small><div id="state">-<\/div><small id="lane"><\/small><\/div>/);
});

test('conductor restart (Shift+R): the button and key are wired, it logs a fix record "restart", the guide and Help say when to use it', async () => {
  assert.equal(C.FIX_KIND.restart, 'restart', 'logged as a fix the scorer reads');
  const { checkRecord } = await import('../../conduct-score.mjs');
  assert.deepEqual(checkRecord({ type: 'fix', ctx: 12.5, id: 3, kind: 'restart', origin: 'fix:key', idx: 0, landedCtx: 12.5 }), [], 'schema v1 takes it');
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  const btn = /<button data-fix="restart"[^>]*>([^<]*)<\/button>/.exec(html);
  assert.ok(btn, 'a restart button among the fix buttons');
  assert.ok(/^[\x20-\x7e]+$/.test(btn[0]), `ASCII label (#205): ${btn[0]}`);
  assert.match(html, /if \(j\.kind === 'restart'\) return ' \(the clock starts again\)'/, '"last fix" reads it without fromBeats');
  const src = fs.readFileSync(path.join(REPO, 'experiments', 'clock.js'), 'utf8');
  assert.match(src, /KeyR: \['restart'\]/, 'Shift+R is a clock hand-fix key (origin fix:key, logged by the page like the others)');
  assert.equal(C.pageKey({ code: 'KeyR', shiftKey: true, target: { tagName: 'BODY' } }), null, 'the page leaves Shift+R to the clock');
  const panel = /<div id="helpPanel" hidden>([\s\S]*?)<\/div>/.exec(html)[1];
  assert.match(panel, /If the tempo or the octave hold is wrong and a tap does not fix it, push Shift\+R \(restart\)\. The clock starts again; the music does not stop\./);
  assert.match(panel, /Cmd\+R/, 'the reload stays as a fallback');
  const guide = fs.readFileSync(path.join(REPO, 'qa', 'CONDUCTOR_GUIDE.md'), 'utf8');
  assert.match(guide, /If the tempo or the octave hold is wrong and a tap does not fix it, push "restart" \(Shift\+R\)\. The clock starts again;\n  the music does not stop\./);
  assert.match(guide, /If that does not help: reload the page \(Cmd\+R\)/);
});

test('D4 on the conductor page: an uneven tap logs a rejected fix and flashes the tap button red; a release is marked; guide and Help say how', () => {
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  assert.match(html, /if \(j && j\.rejected\) \{ rec\.rejected = j\.rejected; rec\.spreadPct = j\.spreadPct; flashReject\(\); \}/, 'the rejected tap is logged with its spread and flashes');
  assert.match(html, /else if \(j && j\.type === 'release-scheduled'\) rec\.release = true;/, 'a second x2 / half press is marked as a release');
  assert.match(html, /button\.reject\{background:#c0182b/, 'the red flash style');
  assert.match(html, /querySelector\('\[data-fix="tap"\]'\)/, 'on the tap button');
  assert.match(html, /REJECTED: uneven taps/, 'the last-fix line says so');
  const panel = /<div id="helpPanel" hidden>([\s\S]*?)<\/div>/.exec(html)[1];
  assert.match(panel, /Press \/2 again to release it/);
  assert.match(panel, /Tap evenly, four or more\. A red flash means the taps were uneven\./);
  assert.ok(/^[\x20-\x7e\s]*$/.test(panel.replace(/<[^>]+>/g, '')), 'Help stays plain ASCII (#205)');
  const guide = fs.readFileSync(path.join(REPO, 'qa', 'CONDUCTOR_GUIDE.md'), 'utf8');
  assert.match(guide, /Press ÷2 again to release it\./);
  assert.match(guide, /Tap evenly, four or more\. A red flash means the taps were uneven/);
});
