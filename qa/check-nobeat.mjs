// No-beat mode QA row for any scene page (the apartment MVP, Task 3). On the box's 780M, as check-shared.mjs:
//   node qa/check-nobeat.mjs --page 16-hodge-kaleidoscope.html [--secs 30] [--query 'capture=1'] [--out dir]
//        [--nobeat-audio <corpus id>[@start-end] | none]   (default born-slippy@0-90: its beatless intro)
// The no-beat phases load the page with audio-in's file source playing that excerpt from the box's tracks (served
// here under /nobeat-audio/<corpus id>, never by file name), so the energy path hears music without a beat, not the
// metronome; the locked phase loads it with the clock's own source. --nobeat-audio none keeps the metronome throughout.
// 1920x1080, ?capture=1 (clean stills; Play pressed by itself), then three phases of --secs each (qa/nobeat.mjs):
// confidence forced to 0, the clock's own (locked), forced to 0 again. Writes check.md (the rows) and one still per
// phase for the user's grading. Exit 1 when a row fails.
// The folder is a grading run, qa/<page>/runs/<stamp>/ under QA_HOME (where the viewer reads runs): results.json with
// one result per phase (nobeat-1, locked, nobeat-2) and stills/0N-<phase>.png, so /grade lists it and its page shows
// one card per phase with keep / maybe / dull (qa/serve.mjs). check.md and nobeat.json sit beside them.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { runNoBeat, verdict, gradeRun, parseNobeatAudio, phaseQuery, NOBEAT_AUDIO_DEFAULT, NOBEAT_AUDIO_ROUTE } from './nobeat.mjs';
import { audioDir, sourceTracks, TYPES } from './runner/audio.mjs';
import { loadMap } from './corpus.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const pageName = arg('page');
if (!pageName || !/^[\w.-]+\.html$/.test(pageName)) { console.error('usage: --page NN-name.html [--secs 30] [--query capture=1]'); process.exit(2); }
const SECS = +arg('secs', 30), query = arg('query', 'capture=1');
// the no-beat phases play this excerpt instead of the metronome (corpus id, R9); --nobeat-audio none: the metronome
const AUDIO = parseNobeatAudio(arg('nobeat-audio', NOBEAT_AUDIO_DEFAULT));
/** the corpus id's source file in the box's tracks folder (never named in a URL or a report), or a reason */
function trackOf(cid) {
  const dir = audioDir();
  if (!fs.existsSync(dir)) return { skip: 'no tracks folder here' };
  const map = loadMap(dir), stem = map.tracks[cid];
  if (map.missing || !stem) return { skip: `${cid} is not in the corpus map` };
  const src = sourceTracks(dir).find(x => x.stem === stem);
  return src ? { path: path.join(dir, src.file), type: TYPES[src.ext] || 'application/octet-stream' } : { skip: `${cid}: no source file` };
}
const TRACK = AUDIO ? trackOf(AUDIO.id) : null;
if (TRACK && TRACK.skip) { console.error(`--nobeat-audio ${AUDIO.id}: ${TRACK.skip} (use --nobeat-audio none for the metronome)`); process.exit(2); }
const id = pageName.replace(/\.html$/, ''), pad = n => String(n).padStart(2, '0'), d = new Date();
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const qaHome = path.resolve(process.env.QA_HOME ? path.join(process.env.QA_HOME, 'qa') : here);
const out = path.resolve(arg('out', path.join(qaHome, id, 'runs', stamp)));
fs.mkdirSync(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((q, res) => {
  const pn = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (pn.startsWith(NOBEAT_AUDIO_ROUTE)) {   // the excerpt's track, by corpus id only
    if (!TRACK || pn !== NOBEAT_AUDIO_ROUTE + AUDIO.id) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TRACK.type }); return fs.createReadStream(TRACK.path).pipe(res);
  }
  const p = path.resolve(expDir, '.' + pn);
  if (!p.startsWith(expDir + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const R0 = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const errors = [];
let code = 0;
try {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/${pageName}?${query}`, { timeout: 30e3 });
  if (!/capture=1/.test(query)) await page.click('#play', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(3000);
  // each phase on its own load of the page: the no-beat phases with the excerpt, the locked phase with the clock's source
  const base = `http://127.0.0.1:${server.address().port}/${pageName}`;
  const gotoPhase = async ph => {
    await page.goto(`${base}?${phaseQuery(query, ph, AUDIO)}`, { timeout: 30e3 });
    if (!/capture=1/.test(query)) await page.click('#play', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(3000);
    return true;
  };
  const res = await runNoBeat(page, { phaseSecs: SECS, outDir: out, gotoPhase: AUDIO ? gotoPhase : null });
  const audioNote = AUDIO ? `no-beat phases on ${AUDIO.id} ${AUDIO.from}-${AUDIO.to ?? 'end'} s (the page's file source), locked phase on the clock` : 'all phases on the metronome';
  const v = verdict(res, { errors, budget: true });
  const md = `# No-beat mode · ${pageName} · ${stamp}\n\n${SECS} s per phase, ?${query}, 1920x1080, ${audioNote}. ${v.pass ? 'PASS' : 'FAIL'}\n\n` + v.lines.map(l => `- ${l}`).join('\n') +
    `\n\nStills for grading (one card each on /grade): ${res.phases.map(p => path.basename(p.still)).join(', ')}\n` + (errors.length ? `\nPage errors:\n${errors.slice(0, 5).map(e => '- ' + e.slice(0, 200)).join('\n')}\n` : '');
  fs.writeFileSync(path.join(out, 'check.md'), md);
  fs.writeFileSync(path.join(out, 'nobeat.json'), JSON.stringify({ page: pageName, secs: SECS, query, audio: AUDIO, ...res, errors, pass: v.pass }, null, 1));
  // the grading run: the renderer decides whether /grade lists it (a software renderer is not graded)
  const gpu = await page.evaluate(() => { try { const gl = document.createElement('canvas').getContext('webgl2'), x = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'none'); } catch (e) { return 'none'; } });
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(gradeRun({ page: pageName, query, secs: SECS, res, verdictLines: v.lines, pass: v.pass, gpu, renderer: gpu, stamp }), null, 1));
  console.log(md);
  if (!v.pass) code = 1;
} finally { await browser.close(); server.close(); }
console.log(out);
process.exit(code);
