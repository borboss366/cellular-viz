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

/** the tracker alone over the audio; `every` runs each 0.1 s with (tr, t) */
function track(mono, every) {
  const tr = T.createTracker();
  let next = 0;
  const an = T.createAnalyzer({ sampleRate: SR, onFrame: f => { tr.push(f); if (f.t >= next) { every(tr, f.t); next = f.t + 0.1; } } });
  for (let i = 0; i < mono.length; i += 128) an.process(mono.subarray(i, Math.min(mono.length, i + 128)), i / SR);
  return tr;
}

test('(a) sandstorm on the real track: the shadow within 1 % of 136 for >= 95 % of the time after its lock (box only)', async (t) => {
  const f = trackFile('sandstorm');
  if (f.skip) { t.skip(f.skip); return; }
  const d = await decode(f, 240);
  if (d.skip) { t.skip(d.skip); return; }
  const trace = [];
  let lockT = null;
  const tr = track(d.mono, (tr, tt) => { if (lockT === null && tr.state === 'locked') lockT = tt; if (lockT !== null) trace.push({ t: tt, bpm: tr.ownBpm, state: tr.state }); });
  const inside = trace.filter(x => Math.abs(x.bpm / 136 - 1) <= 0.01), frac = trace.length ? inside.length / trace.length : 0;
  const out = trace.filter(x => Math.abs(x.bpm / 136 - 1) > 0.01), bins = {};
  for (const x of out) { const k = Math.round(x.bpm); bins[k] = (bins[k] || 0) + 1; }
  const line = `sandstorm (tracker alone): ${(d.mono.length / SR).toFixed(1)} s, lock ${lockT === null ? 'never' : lockT.toFixed(2) + ' s'}, within 1 % of 136 ${(100 * frac).toFixed(1)} % of ${trace.length} samples; outside by bpm ${JSON.stringify(bins)}; first outside ${out.slice(0, 5).map(x => `${x.t.toFixed(1)}:${x.bpm.toFixed(1)}`).join(' ') || 'none'}; end bpm ${tr.ownBpm.toFixed(2)}; relatives ${JSON.stringify(tr.relative)}; jumps ${tr.jumps.map(j => j.kind).join(',') || 'none'}`;
  console.log(`# ${line}`);
  t.diagnostic(line);
  assert.ok(lockT !== null, `locks: ${line}`);
  assert.ok(frac >= 0.95, line);
});

test('(c) gasolina on the real track: a right octave hold (96) never releases over 60 s (box only)', async (t) => {
  const f = trackFile('gasolina');
  if (f.skip) { t.skip(f.skip); return; }
  const d = await decode(f, 200);
  if (d.skip) { t.skip(d.skip); return; }
  let lockT = null, heldAt = null, scale = null;
  const bpms = [];
  const tr = track(d.mono, (tr, tt) => {
    if (lockT === null && tr.state === 'locked') lockT = tt;
    if (lockT !== null && heldAt === null && tt >= lockT + 10) { scale = 2 ** Math.round(Math.log2(96 / tr.ownBpm)); tr.scaleTempo(scale, tt); heldAt = tt; }
    if (heldAt !== null && tt <= heldAt + 60) bpms.push(tr.ownBpm);
  });
  const rel = tr.notes.filter(n => n.kind === 'octave-release'), span = heldAt === null ? 0 : Math.min(60, d.mono.length / SR - heldAt);
  const line = `gasolina (tracker alone): lock ${lockT === null ? 'never' : lockT.toFixed(2) + ' s'}, hold x${scale} at ${heldAt === null ? '-' : heldAt.toFixed(1) + ' s'} for ${span.toFixed(1)} s; releases ${rel.map(n => `${n.why || 'fold'}@${n.t.toFixed(1)} (raw ${n.raw.toFixed(1)})`).join(', ') || 'none'}; bpm min ${bpms.length ? Math.min(...bpms).toFixed(2) : '-'} max ${bpms.length ? Math.max(...bpms).toFixed(2) : '-'}; lock now ${tr.octaveLock}`;
  console.log(`# ${line}`);
  t.diagnostic(line);
  assert.ok(heldAt !== null && span >= 60, `held for 60 s: ${line}`);
  assert.equal(rel.filter(n => n.t <= heldAt + 60).length, 0, `no release: ${line}`);
});
