// #188 6766497000, Sandstorm fixes (a) and (c) on the real corpus: the tracker alone (the conductor's shadow, R3: no
// fix() ever reaches it) on whole tracks decoded by Chromium's own decoder (no ffmpeg, as exp-run and mix-make). On the
// box only: Playwright from the runner settings' QA_HOME (as conduct-smoke), the tracks folder and corpus-map.json
// beside it; skipped anywhere else, with the reason. R9: tracks are named by corpus id only, never by file or stem.
//   (a) tempo rows, sandstorm (136) and gasolina (96): the tracker alone within 1 % from its first lock to the end, #214
//       beside main b1fe5f0 (vendored in fixtures/) in one row; report-only for two runs, then >= 95 % and >= main - 2
//   (c) gasolina: a right hold armed after 2 s within 1 % of 96 never releases in 60 s; a wrong x2 hold (192)
//       releases to 96 within 8 beats through the new evidence path (a 128 hold is printed beside it)
//   (i) re-lock cost of the 2 s tempo hysteresis on real crossfades, report-only, main b1fe5f0 beside #214
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { BUDGET_BEATS, relockFigures, relockText } from './fixtures/relock.mjs';
import { heavyLock } from './fixtures/heavy-lock.mjs';
const heavy = async t => { const release = await heavyLock('tracker-corpus'); t.after(release); };

const require = createRequire(import.meta.url);
const T = require('../../../experiments/clock-tracker.js');
const C = await import('../../corpus.mjs');
const A = await import('../audio.mjs');
const SR = 44100;

function qaHome() {
  const files = [process.env.RUNNER_ENV, path.join(os.homedir(), '.config/cellular-viz-runner.env'), path.join(os.homedir(), '.cache/cellular-viz-runner/runner.env')].filter(Boolean);
  const file = files.find(f => fs.existsSync(f));
  if (!file) return null;
  const line = fs.readFileSync(file, 'utf8').split('\n').filter(l => /^QA_HOME=/.test(l)).pop();
  return line ? line.slice('QA_HOME='.length).trim().replace(/^(['"])(.*)\1$/, '$2') : null;
}

/** the corpus id's source file in the tracks folder, or a skip reason (never a name in the reason) */
function trackFile(id) {
  const dir = A.audioDir();
  if (!fs.existsSync(dir)) return { skip: 'no tracks folder here' };
  const map = C.loadMap(dir);
  if (map.missing) return { skip: 'no corpus-map.json beside the tracks' };
  const stem = map.tracks[id];
  if (!stem) return { skip: `${id} is not in the map` };
  const src = A.sourceTracks(dir).find(x => x.stem === stem);
  if (!src) return { skip: `${id}: no source file` };
  return { path: path.join(dir, src.file), type: A.TYPES[src.ext] || 'application/octet-stream' };
}

/** decode the first `secs` seconds of a file to mono Float32 at SR with Chromium (a one-file server on 127.0.0.1) */
async function decode(file, secs) {
  const home = qaHome();
  if (!home) return { skip: 'no runner settings (QA_HOME): not the box' };
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { return { skip: `no Playwright under QA_HOME/qa: ${e.message}` }; }
  const srv = http.createServer((req, res) => {
    if (req.url === '/a') { res.writeHead(200, { 'content-type': file.type }); fs.createReadStream(file.path).pipe(res); }
    else { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>decode</title>'); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await pw.chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'], env });
  try {
    const page = await b.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    const n = await page.evaluate(async ({ secs, sr }) => {
      const buf = await (await fetch('/a')).arrayBuffer();
      const ab = await new OfflineAudioContext(1, 1, sr).decodeAudioData(buf);
      const n = Math.min(ab.length, Math.round(secs * sr)), ch = ab.numberOfChannels, pcm = new Int16Array(n);
      for (let i = 0; i < n; i++) { let v = 0; for (let c = 0; c < ch; c++) v += ab.getChannelData(c)[i]; pcm[i] = Math.round(Math.max(-1, Math.min(1, v / ch)) * 32767); }
      window.__pcm = pcm;
      return n;
    }, { secs, sr: SR });
    const mono = new Float32Array(n), CH = 1 << 20;   // fetched in pieces of 1 M samples (2 MB), not one huge string
    for (let k = 0; k < n; k += CH) {
      const b64 = await page.evaluate(({ k, CH }) => {
        const u8 = new Uint8Array(window.__pcm.buffer, k * 2, Math.min(CH, window.__pcm.length - k) * 2); let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
        return btoa(s);
      }, { k, CH });
      const raw = Buffer.from(b64, 'base64');
      for (let i = 0; 2 * i + 1 < raw.length; i++) mono[k + i] = raw.readInt16LE(2 * i) / 32768;
    }
    return { mono };
  } finally { await b.close(); srv.close(); }
}

// the baseline (report-only): main b1fe5f0's tracker, vendored as it was before fixes a and c
const BASE = require('./fixtures/clock-tracker-b1fe5f0.cjs');

/** a tracker (new or baseline) over the audio; `every` runs each 0.1 s with (tr, t) */
function track(mono, every, lib = T, sr = SR) {
  const tr = lib.createTracker();
  let next = 0;
  const an = lib.createAnalyzer({ sampleRate: sr, onFrame: f => { tr.push(f); if (f.t >= next) { every(tr, f.t); next = f.t + 0.1; } } });
  for (let i = 0; i < mono.length; i += 128) an.process(mono.subarray(i, Math.min(mono.length, i + 128)), i / sr);
  return tr;
}
/** decoded audio per corpus id, once per file run (the cases share it) */
const decoded = new Map();
async function audio(id, secs) {
  if (!decoded.has(id)) {
    const f = trackFile(id);
    decoded.set(id, f.skip ? f : await decode(f, secs));
  }
  return decoded.get(id);
}
/** the tracker alone, no fixes: its tempo every 0.1 s after its first lock → % within 1 % of ref, time by bpm, 4:3 / 3:4 */
function tempoStats(mono, ref, lib) {
  const trace = [];
  let lockT = null;
  const tr = track(mono, (tr, tt) => { if (lockT === null && tr.state === 'locked') lockT = tt; if (lockT !== null) trace.push({ t: tt, bpm: tr.ownBpm }); }, lib);
  const near = q => trace.filter(x => Math.abs(x.bpm / (ref * q) - 1) <= 0.02).length / 10;
  const bins = {};
  for (const x of trace) if (Math.abs(x.bpm / ref - 1) > 0.01) { const k = Math.round(x.bpm); bins[k] = +(((bins[k] || 0) + 0.1)).toFixed(1); }
  const top = Object.entries(bins).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, s]) => `${k}:${s}s`).join(' ') || 'none';
  const pct = trace.length ? 100 * trace.filter(x => Math.abs(x.bpm / ref - 1) <= 0.01).length / trace.length : 0;
  return { tr, trace, lockT, pct, line: `lock ${lockT === null ? 'never' : lockT.toFixed(2) + ' s'}, within 1 % of ${ref} ${pct.toFixed(1)} % of ${(trace.length / 10).toFixed(1)} s; outside (bpm:s) ${top}; at 4:3 (${(ref * 4 / 3).toFixed(1)} +/- 2 %) ${near(4 / 3)} s, at 3:4 (${(ref * 3 / 4).toFixed(1)}) ${near(3 / 4)} s, at x2 ${near(2)} s, at /2 ${near(0.5)} s` };
}
// test-pr.sh (the runner's copy) prints a passing file's lines only when they start with "corpus: ": the report rows go
// out as "corpus: report: ..." so QA box sees them on every run (ids and numbers only, R9)
function say(t, line) { console.log(`# ${line}`); t.diagnostic(`corpus: report: ${line}`); }

// The tempo rows (304 family): the tracker alone from its first lock to the end, #214 beside main b1fe5f0 in one row.
// REPORT-ONLY for two more box runs (VIZ research on de9b83b, 10 Nov); then hard at >= 95 % AND >= main - 2 points,
// per track.
const TEMPO_ROWS_HARD = false;
/** while the #214 tracker sits near `bpm` (+/- 2 %): what its relative check saw (the stretch's evaluations) */
function stretchEvals(mono, bpm) {
  const seen = new Map();
  let secs = 0;
  track(mono, (tr, tt) => {
    if (tr.state === 'idle' || Math.abs(tr.ownBpm / bpm - 1) > 0.02) return;
    secs += 0.1;
    const ev = tr.relative.eval;
    if (ev && !seen.has(ev.t)) seen.set(ev.t, ev);
  });
  const evs = [...seen.values()], used = evs.filter(e => !e.skipped);
  const best = e => Math.max(0, ...(e.cands || []).map(c => c.ratio || 0));
  const R0s = used.map(e => e.choice.R).filter(x => x !== null);
  return `${secs.toFixed(1)} s near ${bpm}: ${evs.length} estimates (${evs.length - used.length} skipped: ${[...new Set(evs.filter(e => e.skipped).map(e => e.skipped))].join(', ') || '-'}), choice R min ${R0s.length ? Math.min(...R0s).toFixed(3) : '-'} max ${R0s.length ? Math.max(...R0s).toFixed(3) : '-'}, best relative ratio max ${used.length ? Math.max(...used.map(best)).toFixed(3) : '-'}; first evals ${JSON.stringify(used.slice(0, 3))}`;
}
async function tempoRow(t, id, ref, secs, { watch = null } = {}) {
  const d = await audio(id, secs);
  if (d.skip) { t.skip(d.skip); return; }
  const now = tempoStats(d.mono, ref, T), base = tempoStats(d.mono, ref, BASE), tr = now.tr;
  const ok = now.pct >= 95 && now.pct >= base.pct - 2;
  say(t, `${id} ${(d.mono.length / SR).toFixed(1)} s, tracker alone, from its first lock: #214 ${now.pct.toFixed(1)} % | main b1fe5f0 ${base.pct.toFixed(1)} % | delta ${(now.pct - base.pct).toFixed(1)} points | ${ok ? 'would pass' : 'would FAIL'} (>= 95 % and >= main - 2) ${TEMPO_ROWS_HARD ? '[hard]' : '[report-only]'}`);
  say(t, `${id} #214: ${now.line}`);
  say(t, `${id} main b1fe5f0: ${base.line}`);
  say(t, `${id} #214 relatives: ${tr.relative.count} picks, ${tr.relative.moves} landed moves (last at ${tr.relative.lastMoveT}), ${tr.relative.estimates} evaluated, ${tr.relative.skipped} blocked (rate); home ${JSON.stringify(tr.relative.home)}; last move ${JSON.stringify(tr.relative.last)}; closest unmoved ratio ${tr.relative.closest} at ${JSON.stringify(tr.relative.closestAt)}; tempo moves while locked ${tr.relative.tempoMoves}, last pending ${JSON.stringify(tr.relative.tempoHold)}; jumps ${tr.jumps.map(j => j.kind).join(',') || 'none'}`);
  if (watch) say(t, `${id} #214 relative check during the ${watch} stretch: ${stretchEvals(d.mono, watch)}`);
  if (TEMPO_ROWS_HARD) {
    assert.ok(now.lockT !== null, `locks: ${now.line}`);
    assert.ok(ok, `#214 ${now.pct.toFixed(1)} % vs main ${base.pct.toFixed(1)} %: ${now.line}`);
  }
}

test('(a) tempo row sandstorm: within 1 % of 136 from the first lock, #214 beside main b1fe5f0 (report-only for two runs; box only)', async (t) => {
  await heavy(t);   // one heavy box test at a time (fixtures/heavy-lock.mjs)
  await tempoRow(t, 'sandstorm', 136, 240, { watch: 136 * 4 / 3 });
});

test('(a) tempo row gasolina: within 1 % of 96 from the first lock, #214 beside main b1fe5f0, the 128 stretch logged (report-only for two runs; box only)', async (t) => {
  await heavy(t);   // one heavy box test at a time (fixtures/heavy-lock.mjs)
  await tempoRow(t, 'gasolina', 96, 240, { watch: 128 });
});

// (c) on Gasolina, both cases start from the tracker reading 96 within 1 % for >= 2 s (test 305 at 469ac5a set its
// hold while the tracker read 128.09, a 4:3 lock, and the old fold release rightly let it go)
const REF_G = 96;
function untilRight(tr, tt, st) {   // the first sample, after the lock, with the tracker within 1 % of 96 for 2 s
  if (st.lockT === null && tr.state === 'locked') st.lockT = tt;
  if (st.lockT === null || st.rightAt !== null) return;
  if (Math.abs(tr.ownBpm / REF_G - 1) <= 0.01) { if (st.okSince === null) st.okSince = tt; if (tt - st.okSince >= 2) st.rightAt = tt; } else st.okSince = null;
}

test('(c) gasolina: a right hold, armed after 2 s within 1 % of 96, never releases over 60 s (box only)', async (t) => {
  await heavy(t);   // one heavy box test at a time (fixtures/heavy-lock.mjs)
  const d = await audio('gasolina', 240);
  if (d.skip) { t.skip(d.skip); return; }
  const st = { lockT: null, okSince: null, rightAt: null };
  let heldAt = null, worst = null;
  const bpms = [];
  const tr = track(d.mono, (tr, tt) => {
    untilRight(tr, tt, st);
    if (heldAt === null && st.rightAt !== null && st.rightAt - st.lockT <= 60) { tr.scaleTempo(1, tt); heldAt = tt; }   // the hold at the tempo it reads: 96
    if (heldAt !== null && tt <= heldAt + 60) {
      bpms.push(tr.ownBpm);
      const ev = tr.hold.eval;   // the check closest to a release: the longest accumulator, else the first 'wrong'
      if (ev && (worst === null || ev.accS > worst.accS || (ev.wrong && !worst.wrong))) worst = ev;
    }
  });
  const rel = tr.notes.filter(n => n.kind === 'octave-release'), span = heldAt === null ? 0 : Math.min(60, d.mono.length / SR - heldAt);
  const line = `gasolina right hold: lock ${st.lockT === null ? 'never' : st.lockT.toFixed(2) + ' s'}, 96 for 2 s at ${st.rightAt === null ? 'never' : st.rightAt.toFixed(1) + ' s'}, hold at ${heldAt === null ? '-' : heldAt.toFixed(1) + ' s'} for ${span.toFixed(1)} s; releases ${rel.map(n => `${n.why || 'fold'}@${n.t.toFixed(1)} (lock ${n.lock.toFixed(1)}, raw ${n.raw.toFixed(1)})`).join(', ') || 'none'}; bpm min ${bpms.length ? Math.min(...bpms).toFixed(2) : '-'} max ${bpms.length ? Math.max(...bpms).toFixed(2) : '-'}; lock now ${tr.octaveLock}; worst check ${JSON.stringify(worst)}`;
  say(t, line);
  assert.ok(st.lockT !== null, `the tracker locks: ${line}`);
  assert.ok(heldAt !== null, `the tracker never read 96 within 1 % for 2 s in the 60 s after its lock, so no right hold could be armed: ${line}`);
  assert.ok(span >= 60, `the track runs 60 s past the hold: ${line}`);
  assert.equal(rel.filter(n => n.t <= heldAt + 60).length, 0, `no release: ${line}`);
});

/** a wrong hold forced by scaleTempo(f) once the tracker reads 96: when it releases, by which path, when 96 is back */
function forcedHold(mono, f) {
  const st = { lockT: null, okSince: null, rightAt: null };
  let heldAt = null, relAt = null, backAt = null, evAtRel = null, lastEval = null, accAtRel = null;
  const after = [];
  const tr = track(mono, (tr, tt) => {
    untilRight(tr, tt, st);
    if (heldAt === null && st.rightAt !== null && st.rightAt - st.lockT <= 60) { tr.scaleTempo(f, tt); heldAt = tt; }
    if (heldAt === null) return;
    if (relAt === null && tr.octaveLock === null) { relAt = tt; evAtRel = lastEval; accAtRel = { firstWrongS: tr.hold.firstWrongS, resets: tr.hold.resets, lastReset: tr.hold.lastReset }; }
    if (relAt === null) lastEval = tr.hold.eval;
    if (relAt !== null && backAt === null && Math.abs(tr.ownBpm / REF_G - 1) <= 0.01) backAt = tt;
    if (tt <= heldAt + 20) after.push(`${(tt - heldAt).toFixed(1)}:${tr.ownBpm.toFixed(1)}${tr.octaveLock ? 'H' : ''}`);
  });
  const rel = tr.notes.filter(n => n.kind === 'octave-release'), first = rel.find(n => heldAt !== null && n.t >= heldAt) || null;
  const line = `hold x${f.toFixed(3)} (${heldAt === null ? '-' : (REF_G * f).toFixed(1)}): 96 for 2 s at ${st.rightAt === null ? 'never' : st.rightAt.toFixed(1) + ' s'}, hold at ${heldAt === null ? '-' : heldAt.toFixed(1) + ' s'}; released ${relAt === null ? 'never' : '+' + (relAt - heldAt).toFixed(2) + ' s'} by ${first ? (first.why || 'fold') : '-'} (lock ${first ? first.lock.toFixed(1) : '-'}, raw ${first ? first.raw.toFixed(1) : '-'}); last check before it ${JSON.stringify(evAtRel)}; accumulator: first wrong +${accAtRel && accAtRel.firstWrongS !== null && heldAt !== null ? (accAtRel.firstWrongS - heldAt).toFixed(2) : '-'} s, restarted ${accAtRel ? accAtRel.resets : '-'} times, last restart ${JSON.stringify(accAtRel && accAtRel.lastReset)}; 96 again ${backAt === null ? 'never' : '+' + (backAt - heldAt).toFixed(2) + ' s'}; jumps ${tr.jumps.filter(j => heldAt !== null && j.at >= heldAt).map(j => `${j.kind}@+${(j.at - heldAt).toFixed(2)}`).join(', ') || 'none'}; trace (s:bpm, H = held) ${after.filter((_, i) => i % 5 === 0).join(' ')}`;
  return { heldAt, relAt, backAt, first, evAtRel, line };
}

test('(c) gasolina: a wrong x2 hold (192) holds through its 16-bar protection, then releases to 96 within 8 beats through the new path; a 128 hold printed (box only)', async (t) => {
  await heavy(t);   // one heavy box test at a time (fixtures/heavy-lock.mjs)
  const d = await audio('gasolina', 240);
  if (d.skip) { t.skip(d.skip); return; }
  // the user's option 2 (15:36): the hand hold is protected T.HOLD_PROTECT_BARS bars of the held 192 (64 beats, 20 s)
  const x2 = forcedHold(d.mono, 2), h128 = forcedHold(d.mono, 128 / 96), eight = 8 * 60 / REF_G, protectS = T.HOLD_PROTECT_BARS * 4 * 60 / 192;
  const pEnd = x2.heldAt === null ? null : x2.heldAt + protectS;
  say(t, `gasolina wrong hold x2 (protected ${protectS.toFixed(1)} s, to +${protectS.toFixed(1)} s): ${x2.line}`);
  say(t, `gasolina wrong hold 128 (report: 0.415 octave is below the new path's 0.75, so only the old >20 % fold path can release it): ${h128.line}`);
  assert.ok(x2.heldAt !== null, `the tracker never read 96 within 1 % for 2 s in the 60 s after its lock: ${x2.line}`);
  assert.ok(x2.relAt !== null && x2.relAt >= pEnd - 0.2, `held through the protection: ${x2.line}`);
  assert.ok(x2.relAt - pEnd <= eight, `released within 8 beats (${eight.toFixed(2)} s) after the protection ended (+${(x2.relAt - pEnd).toFixed(2)} s): ${x2.line}`);
  assert.ok(x2.first && x2.first.why === 'evidence', `through the new path (why 'evidence', not the old fold): ${x2.line}`);
  assert.ok(x2.evAtRel && x2.evAtRel.wrong === true, `the last check before the release reads wrong = true: ${x2.line}`);
  assert.ok(x2.backAt !== null && x2.backAt - pEnd <= eight, `96 again within 8 beats of the protection's end: ${x2.line}`);
});

// ---------------------------------------------------------------- the cost of ruling (i): re-lock on real crossfades
// (the user, 10 Nov 14:54). REPORT-ONLY: main b1fe5f0 beside #214 on the same audio, the 8-beat budget beside each
// figure, OVER when above it. None of the #17 mixes (qa/mixes.json) changes tempo by more than 3 %: mode A resamples
// the incoming to the outgoing tempo, and mode B (one-more-time -> opus) is 122.9 -> 126.0, +2.5 %. So the row on the
// mode B render is printed for what it is, and a test-made crossfade from two corpus tracks gives the > 3 % case:
// one-more-time (122.9) -> sandstorm (136, +10.7 %), 8 s equal-power, no resample.
function readWavMono(file) {
  const b = fs.readFileSync(file);
  let p = 12, sr = 0, ch = 0, bits = 0, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(p + 10); sr = b.readUInt32LE(p + 12); bits = b.readUInt16LE(p + 22); }
    else if (id === 'data') { data = [p + 8, Math.min(n, b.length - p - 8)]; break; }
    p += 8 + n + (n & 1);
  }
  if (!data || bits !== 16 || !ch) throw new Error('not a 16-bit PCM WAV');
  const frames = Math.floor(data[1] / (2 * ch)), mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) { let v = 0; for (let c = 0; c < ch; c++) v += b.readInt16LE(data[0] + 2 * (i * ch + c)); mono[i] = v / ch / 32768; }
  return { sr, mono };
}
/** both trackers over one mix: re-lock from the midpoint to within 1 % of the new tempo, and % within 1 % over the mix */
function mixRow(label, mono, sr, midS, outBpm, inBpm) {
  const cells = [];
  for (const [name, lib] of [['#214', T], ['main b1fe5f0', BASE]]) {
    const trace = [];
    let lockT = null;
    track(mono, (tr, tt) => { if (lockT === null && tr.state === 'locked') lockT = tt; trace.push({ t: tt, bpm: tr.ownBpm, state: tr.state }); }, lib, sr);
    const scored = trace.filter(x => lockT !== null && x.t >= lockT), ref = x => (x.t < midS ? outBpm : inBpm);
    const pct = scored.length ? 100 * scored.filter(x => Math.abs(x.bpm / ref(x) - 1) <= 0.01).length / scored.length : 0;
    cells.push(`${relockText(name, relockFigures(trace, midS, inBpm))}, whole mix within 1 % ${pct.toFixed(1)} % (from lock ${lockT === null ? 'never' : lockT.toFixed(1) + ' s'})`);
  }
  return `re-lock ${label}, ${outBpm} -> ${inBpm} (${(100 * (inBpm / outBpm - 1)).toFixed(1)} %), from the midpoint ${midS.toFixed(1)} s, budget ${BUDGET_BEATS} beats | ${cells.join(' | ')}`;
}

test('(i) re-lock cost on real crossfades, report-only: the #17 mode B render and a test-made > 3 % crossfade, main b1fe5f0 beside #214 (box only)', async (t) => {
  await heavy(t);   // one heavy box test at a time (fixtures/heavy-lock.mjs)
  const dir = A.audioDir();
  if (!fs.existsSync(dir)) { t.skip('no tracks folder here'); return; }
  const corpus = JSON.parse(fs.readFileSync(new URL('../../corpus.json', import.meta.url), 'utf8')), bpmOf = id => (corpus.find(r => r.id === id) || {}).bpm;
  // the #17 mode B render (mix-make writes it under renders/, named by corpus ids)
  const base = path.join(dir, 'renders', 'mix-one-more-time-opus-b');
  if (fs.existsSync(base + '.wav') && fs.existsSync(base + '.mix.json')) {
    const mj = JSON.parse(fs.readFileSync(base + '.mix.json', 'utf8')), w = readWavMono(base + '.wav');
    say(t, mixRow('#17 mix-one-more-time-opus-b (mode B, under 3 %: the hysteresis does not engage)', w.mono, w.sr, mj.overlap.midS, mj.inputs.out.fit.bpm, mj.inputs.in.fit.bpm));
  } else say(t, 're-lock #17 mix-one-more-time-opus-b: not rendered on this box (qa/mix-make.sh), row skipped');
  // the test-made crossfade: one-more-time [60, 90) s -> sandstorm [30, 70) s, 8 s equal-power from mix 22 s
  const a = await audio('one-more-time', 100), b = await audio('sandstorm', 240);
  if (a.skip || b.skip) { say(t, `re-lock test-made crossfade: skipped (${a.skip || b.skip})`); return; }
  const o0 = 60 * SR, i0 = 30 * SR, fadeA = 22 * SR, fadeB = 30 * SR, n = 62 * SR, mix = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const vo = k < fadeB ? a.mono[o0 + k] || 0 : 0, vi = k >= fadeA ? b.mono[i0 + k - fadeA] || 0 : 0;
    const u = Math.min(1, Math.max(0, (k - fadeA) / (fadeB - fadeA)));
    mix[k] = vo * Math.cos(Math.PI * u / 2) + vi * Math.sin(Math.PI * u / 2);
  }
  say(t, mixRow('test-made crossfade one-more-time -> sandstorm (8 s, no resample)', mix, SR, 26, bpmOf('one-more-time'), bpmOf('sandstorm')));
});

// ---------------------------------------------------------------- F3 harness (the user 14 Nov 02:41: F2 parked, F3 next)
// Shadow rows on every corpus track with an accepted toolVersion 3 vote (its .vote.json beside the track): main
// 501cfe1's tracker (vendored) beside the tracker under test on the same audio: the share of time within 2 % of the
// vote's tempo from the first lock, the longest locked excursion outside 2 % (s), tempoMovesLocked and tempoRefusals
// from the generic tr.tempoReport (main has none: its tempo landings, relative.tempoMoves, are shown as moves).
// HARD: the tracker under test never more than 2 points below main per track. Report-only: >= 95 %. Ids only (R9).
const BASE501 = require('./fixtures/clock-tracker-501cfe1.cjs');
const SHADOW_SECS = 180;
const RECOVERY = ['voodoo-people', 'children', 'block-rockin-beats', 'hc-06'];   // the F2 losses; target >= 60 % after F4
function voteRefs() {
  const dir = A.audioDir();
  if (!fs.existsSync(dir)) return { skip: 'no tracks folder here' };
  const map = C.loadMap(dir);
  if (map.missing) return { skip: 'no corpus-map.json beside the tracks' };
  const out = [];
  for (const [id, stem] of Object.entries(map.tracks).sort((a, b) => a[0].localeCompare(b[0]))) {
    try {
      const v = JSON.parse(fs.readFileSync(path.join(dir, `${stem}.vote.json`), 'utf8'));
      if (v.toolVersion === 3 && v.accepted && v.bpm > 0) out.push({ id, ref: v.bpm });
    } catch { /* no vote for this track */ }
  }
  return { refs: out };
}
function shadowRow(mono, ref, lib) {
  let lockT = null, n = 0, inN = 0, run = 0, longest = 0, firstLockBpm = null;
  const seen = new Map();   // every tempo decision of the tracker under test, polled every 0.1 s from tempoReport.last
  const tr = track(mono, (tr, tt) => {
    const rl = tr.tempoReport && tr.tempoReport.last;
    if (rl && !seen.has(`${rl.t}|${rl.path}`)) seen.set(`${rl.t}|${rl.path}`, rl);
    if (lockT === null && tr.state === 'locked') { lockT = tt; firstLockBpm = tr.ownBpm; }
    if (lockT === null) return;
    n++;
    const ok = Math.abs(tr.ownBpm / ref - 1) <= 0.02;
    if (ok) inN++;
    if (!ok && tr.state === 'locked') { run += 0.1; longest = Math.max(longest, run); } else run = 0;
  }, lib);
  const r = tr.tempoReport || null;
  // the per-id diagnosis: which paths refused, refusals that kept a wrong tempo against a candidate near the ref,
  // accepted moves that left the ref
  const near = b => Math.abs(b / ref - 1) <= 0.02, dec = [...seen.values()];
  const refused = dec.filter(d => !d.ok), heldWrong = refused.filter(d => near(d.cand) && !near(d.cur));
  const by = a => Object.entries(a.reduce((o, d) => ({ ...o, [d.path]: (o[d.path] || 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
  const awayMoves = dec.filter(d => d.ok && d.path !== 'fit' && near(d.cur) && !near(d.cand));
  const fitOk = dec.filter(d => d.ok && d.path === 'fit' && d.cand > 0), fitNear = fitOk.filter(d => near(d.cand)).length;
  const diag = r ? `moves by path ${JSON.stringify(r.movesBy || {})}; fit rejects by reason ${JSON.stringify(r.refusedBy || {})}; fit samples near the ref ${fitNear}, away ${fitOk.length - fitNear}; refused by path ${by(refused)}; refused while the candidate was near the ref and the current tempo was not: ${heldWrong.length} (${by(heldWrong)})${heldWrong.length ? ', e.g. ' + JSON.stringify(heldWrong.slice(0, 2)) : ''}; accepted moves away from the ref ${awayMoves.length} (${by(awayMoves)})` : null;
  return { lockT, firstLockBpm, pct: n ? 100 * inN / n : 0, longest, moves: r ? r.tempoMovesLocked : tr.relative.tempoMoves, refusals: r ? r.tempoRefusals : null, diag };
}
test('F3 shadow rows: main 501cfe1 beside the tracker under test on every accepted toolVersion 3 vote ref; never more than 2 points below main (hard; box only)', async (t) => {
  await heavy(t);   // one heavy box test at a time (fixtures/heavy-lock.mjs)
  const v = voteRefs();
  if (v.skip) { t.skip(v.skip); return; }
  if (!v.refs.length) { t.skip('no accepted toolVersion 3 vote refs beside the tracks'); return; }
  let rows = 0;
  const worse = [];
  const fmt = (r, label) => `${label} ${r.pct.toFixed(1)} % within 2 %, longest locked excursion ${r.longest.toFixed(1)} s, tempoMovesLocked ${r.moves}, tempoRefusals ${r.refusals === null || r.refusals === undefined ? '-' : r.refusals}, lock ${r.lockT === null ? 'never' : r.lockT.toFixed(1) + ' s'}`;
  for (const { id, ref } of v.refs) {
    const f = trackFile(id);
    const d = f.skip ? f : await decode(f, SHADOW_SECS);   // not cached: up to 33 tracks
    if (d.skip) { say(t, `F3 ${id}: skipped (${d.skip})`); continue; }
    const now = shadowRow(d.mono, ref, T), base = shadowRow(d.mono, ref, BASE501);
    const regress = now.pct < base.pct - 2;
    if (regress) worse.push(`${id}: now ${now.pct.toFixed(1)} % vs main ${base.pct.toFixed(1)} %`);
    say(t, `F3 ${id} ref ${ref} (${(d.mono.length / SR).toFixed(0)} s): ${fmt(now, 'now')} | ${fmt(base, 'main 501cfe1')} | delta ${(now.pct - base.pct).toFixed(1)} points | ${regress ? 'REGRESSION (> 2 points below main) [hard]' : 'no regression [hard]'} | ${now.pct >= 95 ? 'would pass' : 'would FAIL'} >= 95 % [report-only]`);
    if (now.diag) say(t, `F3 ${id} tempo: ${now.diag}`);
    // report-only: tempoMovesLocked (target <= 2), the first lock's tempo and its ratio to the ref
    const fl = x => x.firstLockBpm === null ? 'never' : `${x.firstLockBpm.toFixed(2)} (x${(x.firstLockBpm / ref).toFixed(3)})`;
    say(t, `F3 ${id} first lock: now ${fl(now)}, main ${fl(base)}; tempoMovesLocked now ${now.moves} (target <= 2) [report-only]`);
    if (RECOVERY.includes(id)) say(t, `F3 recovery ${id}: now ${now.pct.toFixed(1)} % within 2 % (main ${base.pct.toFixed(1)} %), target >= 60 % after F4 ${now.pct >= 60 ? 'met' : 'not met'} [report-only]`);
    rows++;
  }
  say(t, `F3 shadow rows: ${rows} of ${v.refs.length} accepted toolVersion 3 refs; regressions ${worse.length}${worse.length ? ': ' + worse.join('; ') : ''}`);
  assert.deepEqual(worse, [], 'within 2 points of main on every track');
});
