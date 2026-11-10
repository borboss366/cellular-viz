// #188 6766497000, Sandstorm fixes (a) and (c) on the real corpus: the tracker alone (the conductor's shadow, R3: no
// fix() ever reaches it) on whole tracks decoded by Chromium's own decoder (no ffmpeg, as exp-run and mix-make). On the
// box only: Playwright from the runner settings' QA_HOME (as conduct-smoke), the tracks folder and corpus-map.json
// beside it; skipped anywhere else, with the reason. R9: tracks are named by corpus id only, never by file or stem.
//   (a) sandstorm: the shadow's tempo within 1 % of 136 for >= 95 % of the time after its first lock (it locked 4:3 at
//       180.8 in the 10 Nov sitting)
//   (c) gasolina: a right octave hold (96, set 10 s after the lock) never releases over the next 60 s
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

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
function track(mono, every, lib = T) {
  const tr = lib.createTracker();
  let next = 0;
  const an = lib.createAnalyzer({ sampleRate: SR, onFrame: f => { tr.push(f); if (f.t >= next) { every(tr, f.t); next = f.t + 0.1; } } });
  for (let i = 0; i < mono.length; i += 128) an.process(mono.subarray(i, Math.min(mono.length, i + 128)), i / SR);
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
function say(t, line) { console.log(`# ${line}`); t.diagnostic(line); }

test('(a) sandstorm on the real track: the shadow within 1 % of 136 for >= 95 % of the time after its lock; main b1fe5f0 printed beside it (box only)', async (t) => {
  const d = await audio('sandstorm', 240);
  if (d.skip) { t.skip(d.skip); return; }
  const now = tempoStats(d.mono, 136, T), base = tempoStats(d.mono, 136, BASE), tr = now.tr;
  say(t, `sandstorm ${(d.mono.length / SR).toFixed(1)} s, tracker alone. #214: ${now.line}. main b1fe5f0 (report): ${base.line}. delta ${(now.pct - base.pct).toFixed(1)} points`);
  say(t, `sandstorm #214 relatives: ${tr.relative.count} moves of ${tr.relative.estimates} estimates, last move ${JSON.stringify(tr.relative.last)}, closest unmoved ratio ${tr.relative.closest} at ${JSON.stringify(tr.relative.closestAt)}, last eval ${JSON.stringify(tr.relative.eval)}; jumps ${tr.jumps.map(j => j.kind).join(',') || 'none'}`);
  assert.ok(now.lockT !== null, `locks: ${now.line}`);
  assert.ok(now.pct >= 95, `#214 ${now.line} (main b1fe5f0: ${base.line})`);
});

// (c) on Gasolina, both cases start from the tracker reading 96 within 1 % (test 305 at 469ac5a set its hold while
// the tracker read 128.09, a 4:3 lock, and the old fold release rightly let it go)
const REF_G = 96;
function untilRight(tr, tt, st) {   // the first sample, after the lock, with the tracker within 1 % of 96 for 1 s
  if (st.lockT === null && tr.state === 'locked') st.lockT = tt;
  if (st.lockT === null || st.rightAt !== null) return;
  if (Math.abs(tr.ownBpm / REF_G - 1) <= 0.01) { if (st.okSince === null) st.okSince = tt; if (tt - st.okSince >= 1) st.rightAt = tt; } else st.okSince = null;
}

test('(c) gasolina on the real track: a right hold, set once the tracker reads 96, never releases over 60 s; main b1fe5f0 printed (box only)', async (t) => {
  const d = await audio('gasolina', 240);
  if (d.skip) { t.skip(d.skip); return; }
  const base = tempoStats(d.mono, REF_G, BASE), now = tempoStats(d.mono, REF_G, T);
  say(t, `gasolina ${(d.mono.length / SR).toFixed(1)} s, tracker alone, no hold. #214: ${now.line}. main b1fe5f0 (report): ${base.line}`);
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
  const line = `gasolina right hold: lock ${st.lockT === null ? 'never' : st.lockT.toFixed(2) + ' s'}, reads 96 from ${st.rightAt === null ? 'never' : st.rightAt.toFixed(1) + ' s'}, hold at ${heldAt === null ? '-' : heldAt.toFixed(1) + ' s'} for ${span.toFixed(1)} s; releases ${rel.map(n => `${n.why || 'fold'}@${n.t.toFixed(1)} (lock ${n.lock.toFixed(1)}, raw ${n.raw.toFixed(1)})`).join(', ') || 'none'}; bpm min ${bpms.length ? Math.min(...bpms).toFixed(2) : '-'} max ${bpms.length ? Math.max(...bpms).toFixed(2) : '-'}; lock now ${tr.octaveLock}; worst check ${JSON.stringify(worst)}`;
  say(t, line);
  assert.ok(st.lockT !== null, `the tracker locks: ${line}`);
  assert.ok(heldAt !== null, `the tracker never read 96 within 1 % (for 1 s) in the 60 s after its lock, so no right hold could be set: ${line}`);
  assert.ok(span >= 60, `the track runs 60 s past the hold: ${line}`);
  assert.equal(rel.filter(n => n.t <= heldAt + 60).length, 0, `no release: ${line}`);
});

test('(c) gasolina on the real track: a wrong hold forced at 128 (4:3) releases and the tracker reads 96 again (box only)', async (t) => {
  const d = await audio('gasolina', 240);
  if (d.skip) { t.skip(d.skip); return; }
  const st = { lockT: null, okSince: null, rightAt: null };
  let heldAt = null, relAt = null, backAt = null;
  const after = [];
  const tr = track(d.mono, (tr, tt) => {
    untilRight(tr, tt, st);
    if (heldAt === null && st.rightAt !== null && st.rightAt - st.lockT <= 60) { tr.scaleTempo(128 / tr.ownBpm, tt); heldAt = tt; }   // the 4:3 hold
    if (heldAt === null) return;
    if (relAt === null && tr.octaveLock === null) relAt = tt;
    if (relAt !== null && backAt === null && Math.abs(tr.ownBpm / REF_G - 1) <= 0.01) backAt = tt;
    if (tt <= heldAt + 30) after.push(`${(tt - heldAt).toFixed(1)}:${tr.ownBpm.toFixed(1)}${tr.octaveLock ? 'H' : ''}`);
  });
  const rel = tr.notes.filter(n => n.kind === 'octave-release');
  const line = `gasolina hold forced at 128: reads 96 from ${st.rightAt === null ? 'never' : st.rightAt.toFixed(1) + ' s'}, hold at ${heldAt === null ? '-' : heldAt.toFixed(1) + ' s'}; released ${relAt === null ? 'never' : '+' + (relAt - heldAt).toFixed(1) + ' s'} (${rel.map(n => `${n.why || 'fold'} lock ${n.lock.toFixed(1)} raw ${n.raw.toFixed(1)}`).join(', ') || 'none'}); 96 again ${backAt === null ? 'never' : '+' + (backAt - heldAt).toFixed(1) + ' s'}; trace (s after hold:bpm, H = held) ${after.filter((_, i) => i % 5 === 0).join(' ')}`;
  say(t, line);
  assert.ok(heldAt !== null, `the tracker never read 96 within 1 % (for 1 s) in the 60 s after its lock: ${line}`);
  assert.ok(relAt !== null && relAt - heldAt <= 10, `the 128 hold releases within 10 s: ${line}`);
  assert.ok(backAt !== null && backAt - relAt <= 8, `the tracker reads 96 within 8 s of the release: ${line}`);
});
