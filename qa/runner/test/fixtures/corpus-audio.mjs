// The box's corpus audio for report rows (#239 c3, hold-sim.test.mjs): qaHome, trackFile and decode copied verbatim
// from tracker-corpus.test.mjs (a test file can't be imported without running its tests). Box only: Playwright from
// the runner settings' QA_HOME, the tracks folder and corpus-map.json beside it; elsewhere each returns { skip }.
// R9: tracks are named by corpus id only, never by file or stem. Keep in step with tracker-corpus.test.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const C = await import('../../../corpus.mjs');
const A = await import('../../audio.mjs');
export const SR = 44100;

export function qaHome() {
  const files = [process.env.RUNNER_ENV, path.join(os.homedir(), '.config/cellular-viz-runner.env'), path.join(os.homedir(), '.cache/cellular-viz-runner/runner.env')].filter(Boolean);
  const file = files.find(f => fs.existsSync(f));
  if (!file) return null;
  const line = fs.readFileSync(file, 'utf8').split('\n').filter(l => /^QA_HOME=/.test(l)).pop();
  return line ? line.slice('QA_HOME='.length).trim().replace(/^(['"])(.*)\1$/, '$2') : null;
}

/** the corpus id's source file in the tracks folder, or a skip reason (never a name in the reason) */
export function trackFile(id) {
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
export async function decode(file, secs) {
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
