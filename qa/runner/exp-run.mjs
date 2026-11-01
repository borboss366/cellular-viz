#!/usr/bin/env node
// Runs one experiment file in headless Chromium. The runner calls it for a qa-ready PR; nobody types it.
//   node qa/runner/exp-run.mjs --file <exp.json> --experiments <PR pages> --qa <tree>/qa --out <result dir>
//                              [--experiments-old <older pages> --vs <sha>] [--pr N] [--sha <sha>] [--audio-dir <dir>]
// The real tracks (audio.mjs, #95 truth (b)) are served from --audio-dir / $QA_AUDIO_DIR under /qa-audio/<name> on this
// 127.0.0.1 server only; runs and gates on a missing track are skipped, and reports keep only file names and sha256.
// Writes into --out: results.json, check.md (the gates, read by qa/builds.mjs finish), report.md, stills/, debug/, checks/<script>/.
// With "swipe" it also records the old and new pages through qa/run.mjs into one run folder for the grading page,
// and names it in results.json (swipe.dir). Prints the --out folder as its last line.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { loadFile, expand, query, evalGates, gatesFromMd, checkMd, readExpr, METRICS } from './experiment.mjs';
import { PROBES } from './probes.mjs';
import { readGpuBusy } from './gpu.mjs';
import { audioDir, serveAudio, tracksUsed, trackInfo, describe } from './audio.mjs';
import { excerptPath, excerptName, wavBytes, readWav, analyse, audioMetrics, audioGateMetrics, writeAtomic, DEVICE } from './audiocheck.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d; };
const FILE = arg('file'), EXP_DIR = path.resolve(arg('experiments', '')), OLD_DIR = arg('experiments-old') ? path.resolve(arg('experiments-old')) : null;
const QA = path.resolve(arg('qa', '')), OUT = path.resolve(arg('out', '')), PR = arg('pr', ''), SHA = arg('sha', ''), VS = arg('vs', '');
const { errors: bad, exp } = loadFile(FILE);
if (bad.length) { console.error(bad.join('\n')); process.exit(3); }
fs.mkdirSync(path.join(OUT, 'debug'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
fs.copyFileSync(FILE, path.join(OUT, 'experiment.json'));
const notes = [];
const note = s => { notes.push(s); console.error(s); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const safe = s => String(s).replace(/[^\w.@-]+/g, '-');
const AUDIO_DIR = audioDir(arg('audio-dir'));
process.env.QA_AUDIO_DIR = AUDIO_DIR;   // the check scripts below inherit it
const tracks = await Promise.all(tracksUsed(exp).map(n => trackInfo(n, AUDIO_DIR)));
const missing = tracks.filter(t => t.missing).map(t => t.name);
if (tracks.length) note(`tracks: ${describe(tracks)}`);

// ---- static server: the PR's experiments/ folder (or the old one under /old/) ----
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.glsl': 'text/plain' };
const server = http.createServer((req, res) => {
  if (serveAudio(req, res, AUDIO_DIR)) return;   // /qa-audio/<name>: the fixed track names only
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  const p = path.resolve(EXP_DIR, rel);
  if (!p.startsWith(EXP_DIR + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/${exp.page}.html`;

// ---- browser: the same GPU set-up as qa/run.mjs (kind "render": SwiftShader, the CPU renderer, #141) ----
const renderNode = '/dev/dri/renderD128', hasGpu = exp.kind !== 'render' && fs.existsSync(renderNode);
const flags = ['--autoplay-policy=no-user-gesture-required'];
if (hasGpu) flags.push('--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization');
else flags.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(fs.existsSync);
if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
if (hasGpu && fs.existsSync(path.join(libRoot, 'usr/share/glvnd/egl_vendor.d'))) {
  env.__EGL_VENDOR_LIBRARY_DIRS = path.join(libRoot, 'usr/share/glvnd/egl_vendor.d');
  env.LIBGL_DRIVERS_PATH = path.join(libRoot, 'usr/lib/x86_64-linux-gnu/dri');
}
const fontsConf = path.join(os.homedir(), 'qa-libs/fonts.conf');
if (!env.FONTCONFIG_FILE && fs.existsSync(fontsConf)) env.FONTCONFIG_FILE = fontsConf;
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';

// ---- kind "audio" (#141): a track excerpt as the page's line input ----
// via "fake": Chromium plays the excerpt WAV as its fake capture device from the moment the page opens it (noloop:
// once, then silence). The WAV is cut once per (track, from, len) by Chromium's own decoder (no ffmpeg) and kept in
// QA_AUDIO_DIR next to the track, never committed or served. The offline analysis of the same WAV is the truth the
// page's live bands are compared with.
const A = exp.audio, audioMissing = A ? missing.includes(A.track) : false;
let excerpt = null, wav = null;
const offlines = new Map();   // the offline analysis per analyser smoothing (the page reports its own)
const offlineFor = sm => { const k = Number.isFinite(sm) ? sm : 0; if (!offlines.has(k)) offlines.set(k, analyse(wav.mono, wav.sampleRate, { fftSize: 2048, smoothing: k })); return offlines.get(k); };
async function makeExcerpt() {
  const dest = excerptPath(AUDIO_DIR, A);
  if (!fs.existsSync(dest)) {
    const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'], env });
    try {
      const page = await b.newPage();
      await page.goto(BASE.replace(/\/[^/]*$/, '/'), { timeout: 30e3 }).catch(() => {});   // the same origin as /qa-audio/
      const got = await page.evaluate(async ({ track, from, len }) => {
        const buf = await (await fetch('/qa-audio/' + track)).arrayBuffer();
        const ab = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(buf);
        const sr = ab.sampleRate, ch = Math.min(2, ab.numberOfChannels), a0 = Math.floor(from * sr), n = Math.max(0, Math.min(ab.length - a0, Math.round(len * sr)));
        const pcm = new Int16Array(n * ch);
        for (let c = 0; c < ch; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) pcm[i * ch + c] = Math.round(Math.max(-1, Math.min(1, d[a0 + i])) * 32767); }
        const u8 = new Uint8Array(pcm.buffer); let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
        return { sr, ch, n, b64: btoa(s) };
      }, A);
      if (!got.n) throw new Error(`the track is shorter than from ${A.from} s`);
      const pcm = Buffer.from(got.b64, 'base64');
      writeAtomic(dest, wavBytes(new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2), got.sr, got.ch));
      note(`audio: cut ${excerptName(A)} (${got.ch} ch, ${got.sr} Hz, ${(got.n / got.sr).toFixed(1)} s) with Chromium's decoder`);
    } finally { await b.close(); }
  }
  return dest;
}
const audioFlags = () => ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${excerpt}${A.noloop ? '%noloop' : ''}`];
const needClip = exp.gates.some(g => g.metric.startsWith('clip') || g.metric.startsWith('lum'));
const shared = {};

async function measure(browser, run) {
  // before this run's page exists: the lowest of 6 readings over 3 s, so the tail of our own previous run (a 6 fps
  // page keeps the GPU busy for a while after it closes) doesn't count, and only load from outside does
  const seen = [];
  for (let i = 0; i < 6; i++) { await sleep(500); const b = readGpuBusy(); if (b !== null) seen.push(b); }
  const busy = seen.length ? Math.min(...seen) : null;
  const page = await browser.newPage({ viewport: { width: run.size.w, height: run.size.h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const probes = Object.entries(exp.debug).map(([k, value]) => ({ k, p: PROBES[k], ctx: {
    page, browser, run, value, state: {}, shared, t: 0, frames: null, note: s => note(`${run.label} ${k}: ${s}`),
    path: name => path.join(OUT, 'debug', name), write: (name, data) => fs.writeFileSync(path.join(OUT, 'debug', name), data) } }));
  const call = async (phase, extra = {}) => { for (const { k, p, ctx } of probes) if (p[phase]) { Object.assign(ctx, extra); try { await p[phase](ctx); } catch (e) { note(`${run.label} probe ${k}.${phase}: ${e.message}`); } } };
  const r = { label: run.label, variant: run.variant, base: run.base, size: run.size, params: run.params, url: `${exp.page}.html?${query(run.params)}`, metrics: { gpuBusy: busy }, values: {}, stills: [] };
  try {
    await call('init');
    await page.goto(`${BASE}?${query(run.params)}`, { waitUntil: 'load', timeout: 60e3 });
    await page.addStyleTag({ content: FULL }).catch(() => {});
    await sleep(800);
    if (exp.play) await page.click('#play', { timeout: 3000 }).catch(() => {});
    await sleep(exp.warmup * 1000);
    await call('start');
    await page.evaluate(() => { window.__qaFT = []; window.__qaFTon = true; const f = n => { window.__qaFT.push(n); if (window.__qaFTon) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const t0 = Date.now(), ticking = probes.some(x => x.p.tick);
    while (Date.now() - t0 < exp.seconds * 1000) {
      await sleep(ticking ? 250 : Math.min(1000, exp.seconds * 1000 - (Date.now() - t0)));
      if (ticking) await call('tick', { t: (Date.now() - t0) / 1000 });
    }
    const t = await page.evaluate(() => { window.__qaFTon = false; return window.__qaFT; });
    const dt = t.slice(1).map((x, i) => x - t[i]), s = [...dt].sort((a, b) => a - b);
    if (dt.length > 1) {
      const p95 = s[Math.floor(s.length * 0.95)];
      Object.assign(r.metrics, { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(2), 'fps.p05': +(1000 / p95).toFixed(2), 'frameMs.p95': +p95.toFixed(2),
        'frameMs.max': +s.at(-1).toFixed(2), longFrames: +(100 * dt.filter(x => x > 20).length / dt.length).toFixed(2), frames: dt.length });
    } else note(`${r.label}: no frames drawn in ${exp.seconds} s`);
    await call('end', { frames: dt.map(x => +x.toFixed(3)) });
    if (needClip) {
      const c = await page.evaluate(async secs => {
        const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
        if (!gl) return null;
        const c2 = document.createElement('canvas'); c2.width = gl.width; c2.height = gl.height;
        const x = c2.getContext('2d', { willReadFrequently: true }), fr = [], lu = [], t0 = performance.now();
        // a rAF callback booked from a timer runs after the page's own callback of that frame, so it sees the drawn frame
        await new Promise(done => { const f = () => {
          x.drawImage(gl, 0, 0); const d = x.getImageData(0, 0, c2.width, c2.height).data; let clip = 0, n = 0, lum = 0;
          for (let i = 0; i < d.length; i += 8) { if (d[i] >= 254 || d[i + 1] >= 254 || d[i + 2] >= 254) clip++; lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
          fr.push(clip / n); lu.push(lum / n / 2.55);   // luminance of the sRGB values (Rec. 709 weights), % of white
          if (performance.now() - t0 < secs * 1000) setTimeout(() => requestAnimationFrame(f), 90); else done(); }; requestAnimationFrame(f); });
        return { worst: Math.max(...fr), mean: fr.reduce((a, b) => a + b, 0) / fr.length, n: fr.length, size: [c2.width, c2.height],
                 lumMean: lu.reduce((a, b) => a + b, 0) / lu.length, lumMin: Math.min(...lu), lumMax: Math.max(...lu) };
      }, Math.min(exp.seconds, 16));
      if (c) Object.assign(r.metrics, { clip: +(100 * c.worst).toFixed(3), 'clip.mean': +(100 * c.mean).toFixed(3), clipFrames: c.n,
        'lum.mean': +c.lumMean.toFixed(2), 'lum.min': +c.lumMin.toFixed(2), 'lum.max': +c.lumMax.toFixed(2) });
      else note(`${r.label}: no canvas for the clip measure`);
    }
    for (const [k, e] of Object.entries(exp.values))
      r.values[k] = await page.evaluate(readExpr(e)).catch(err => 'error: ' + err.message);
    if (A) {   // the audio gates' numbers: the page's per-frame log against the offline analysis of the excerpt
      const info = await page.evaluate(() => { const a = window.__qa && window.__qa.audioIn; return a ? JSON.parse(JSON.stringify(a)) : null; }).catch(() => null);
      const m = audioMetrics(info && info.log, info, wav ? offlineFor(info && info.smoothing) : null, A, A.via);
      Object.assign(r.metrics, audioGateMetrics(m));
      const { log: _log, ...head } = info || {};
      r.audio = { ...m, status: head.status || null, error: head.error || null, smoothing: head.smoothing ?? null, logged: info && info.log ? info.log.length : 0 };
      fs.writeFileSync(path.join(OUT, 'debug', `audio-${safe(r.label)}.json`), JSON.stringify({ audioIn: head, metrics: m, log: info ? info.log : null }));
    }
    for (let i = 0; i < exp.record.stills; i++) {
      const f = `stills/${safe(r.label)}${exp.record.stills > 1 ? '-' + (i + 1) : ''}.png`;
      await page.screenshot({ path: path.join(OUT, f) }).then(() => r.stills.push(f)).catch(e => note(`${r.label} still: ${e.message}`));
      if (i + 1 < exp.record.stills) await sleep(1000);
    }
    const qaErr = await page.evaluate(() => (window.__qa && Array.isArray(window.__qa.errors) ? window.__qa.errors.map(String) : [])).catch(() => []);
    errors.push(...qaErr);
    await call('done');
  } catch (e) {
    errors.push(`runner: ${e.message.split('\n')[0]}`);
  }
  r.metrics.errors = errors.length;
  r.errors = errors.slice(0, 20);
  await page.close().catch(() => {});
  return r;
}

function runNode(script, args) {
  return new Promise(resolve => {
    const p = spawn('node', [script, ...args], { cwd: path.dirname(QA), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => { out = (out + d).slice(-2e6); });
    p.stderr.on('data', d => { err = (err + d).slice(-2e6); process.stderr.write(d); });
    p.on('error', e => { err += String(e); });
    p.on('close', code => resolve({ code, out, err }));
  });
}
const lastLine = s => (s.trim().split('\n').pop() || '').trim();

// ---- 1. measured runs ----
const runs = [];
if (A && !audioMissing && exp.seconds > 0) {
  try {
    excerpt = await makeExcerpt();
    wav = readWav(fs.readFileSync(excerpt));
    note(`audio: excerpt ${excerptName(A)}, ${wav.channels} ch, ${wav.sampleRate} Hz, ${(wav.mono.length / wav.sampleRate).toFixed(1)} s; fake capture ${A.noloop ? "once (noloop)" : "looped"}`);
  } catch (e) { note(`audio: no excerpt for ${A.track} (${e.message}); its runs are skipped`); }
}
if (exp.seconds > 0) {
  const browser = await chromium.launch({ args: A && excerpt ? [...flags, ...audioFlags()] : flags, env });
  for (const run of expand(exp)) {
    const skip = missing.includes(run.params.track) ? run.params.track : A && (audioMissing || !excerpt) ? A.track : null;
    if (skip) {   // never a fail: the user hasn't copied that track to the box yet
      note(`${run.label}: skipped, track missing (${skip})`);
      runs.push({ label: run.label, variant: run.variant, base: run.base, size: run.size, params: run.params, skipped: skip, metrics: {}, values: {}, stills: [], errors: [] });
      continue;
    }
    if (A) run.params = { audio: 'line', device: DEVICE[A.via], ...run.params };   // the page opens the excerpt as its line input
    console.error(`run ${run.label}`); runs.push(await measure(browser, run));
  }
  await browser.close();
}
server.close();

// ---- 2. check scripts (from the trusted qa/ tree, never the PR) ----
const checks = [];
for (const c of exp.checks) {
  const script = path.join(QA, c.script + '.mjs');
  if (!fs.existsSync(script)) { checks.push({ script: c.script, gates: [{ name: `${c.script}: the script exists on the checks ref`, ok: false, value: 'not found' }] }); continue; }
  console.error(`check ${c.script}`);
  const r = await runNode(script, ['--experiments', EXP_DIR, ...c.args]);
  const src = path.resolve(path.dirname(QA), lastLine(r.out)), dest = path.join(OUT, 'checks', c.script);
  let gates;
  if (src.startsWith(QA + path.sep) && fs.existsSync(path.join(src, 'check.md'))) {
    fs.cpSync(src, dest, { recursive: true });
    gates = gatesFromMd(fs.readFileSync(path.join(src, 'check.md'), 'utf8')).map(g => ({ ...g, name: `${c.script}: ${g.name}` }));
    if (!gates.length) gates = [{ name: `${c.script}: check.md has gates`, ok: false, value: 'no ✅/❌ rows' }];
  } else gates = [{ name: `${c.script}: ran to the end and wrote check.md`, ok: false, value: `exit ${r.code}: ${(r.err || r.out).trim().split('\n').slice(-3).join(' / ')}` }];
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'stderr.log'), r.err.slice(-50000));
  checks.push({ script: c.script, code: r.code, dir: path.relative(OUT, dest), gates });
}

// ---- 3. swipe recording: old and new through qa/run.mjs, merged into one run for the grading page ----
let swipe = null;
if (exp.swipe) {
  const stamp = path.basename(OUT), sides = [...(OLD_DIR ? [['old', OLD_DIR]] : []), ['new', EXP_DIR]], parts = [];
  for (const [side, dir] of sides) {
    const vf = path.join(OUT, `swipe-${side}.txt`);
    fs.writeFileSync(vf, exp.variants.filter(v => exp.swipe.variants.includes(v.name)).map(v => `${side}-${v.name} :: ${query({ ...exp.params, ...v.params })}`).join('\n') + '\n');
    console.error(`swipe ${side}`);
    const r = await runNode(path.join(QA, 'run.mjs'), ['--exp', `${exp.page}.html`, '--variants', vf, '--warm', String(exp.swipe.warmup), '--dur', String(exp.swipe.seconds), '--experiments', dir, '--tag', `pr${PR}-${side}`]);
    const d = path.resolve(path.dirname(QA), lastLine(r.out));
    if (r.code === 0 && d.startsWith(QA + path.sep) && fs.existsSync(path.join(d, 'results.json'))) parts.push([side, d]);
    else note(`swipe ${side}: qa/run.mjs exit ${r.code}: ${r.err.trim().split('\n').slice(-2).join(' / ')}`);
  }
  if (parts.length === sides.length) {
    const dir = path.join(path.dirname(parts[0][1]), `${stamp}-swipe`), all = [];
    let meta = null, report = '', log = '';
    for (const [side, d] of parts) {
      const j = JSON.parse(fs.readFileSync(path.join(d, 'results.json'), 'utf8'));
      meta = j.meta;
      all.push(...j.results);
      for (const sub of ['stills', 'videos']) if (fs.existsSync(path.join(d, sub))) fs.cpSync(path.join(d, sub), path.join(dir, sub), { recursive: true });
      report += `\n## ${side} (${side === 'old' ? VS : SHA.slice(0, 7)})\n\n` + fs.readFileSync(path.join(d, 'report.md'), 'utf8');
      log += `## ${side}\n` + (fs.existsSync(path.join(d, 'console.log')) ? fs.readFileSync(path.join(d, 'console.log'), 'utf8') : '');
      fs.rmSync(d, { recursive: true, force: true });
    }
    meta.stamp = path.basename(dir); meta.swipe = { pr: +PR || null, old: VS || null, new: SHA || null };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ meta, results: all }, null, 1));
    fs.writeFileSync(path.join(dir, 'report.md'), `# ${exp.page} · swipe run for #${PR}: ${VS ? `old ${VS} vs ` : ''}new ${SHA.slice(0, 7)}\n` + report);
    fs.writeFileSync(path.join(dir, 'console.log'), log);
    swipe = { dir: path.relative(QA, dir), url: `/run/${path.basename(path.dirname(path.dirname(dir)))}/${path.basename(dir)}/compare`, old: VS || null, new: SHA || null };
  }
}

// ---- 4. results ----
const gates = [...evalGates(exp, runs, { missing }), ...checks.flatMap(c => c.gates)];
// --swipe-optional: the runner's default swipe (the file asked for none): a failed recording is a note, not a fail
if (exp.swipe && !swipe) gates.push({ name: 'swipe run recorded', ...(arg('swipe-optional') ? { ok: null, skipped: true } : { ok: false }), value: notes.filter(n => n.startsWith('swipe')).join(' / ') || 'failed' });
if (!gates.length) gates.push({ name: 'the experiment ran', ok: runs.length > 0 || checks.length > 0, value: `${runs.length} runs` });
const info = [['PR', `#${PR} @${SHA.slice(0, 7)}`], ['GPU', hasGpu ? `${renderNode} (ANGLE gl-egl)` : 'none: software GL, fps not comparable'],
  ...runs.filter(r => r.errors.length).map(r => [`errors ${r.label}`, r.errors.slice(0, 3).join(' / ')]), ...notes.map(n => ['note', n])];
fs.writeFileSync(path.join(OUT, 'check.md'), checkMd(`${exp.id} · experiment for #${PR} @${SHA.slice(0, 7)}`, gates, info));
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ id: exp.id, page: exp.page, kind: exp.kind || 'both', pr: +PR || null, sha: SHA, vs: VS || null, at: new Date().toISOString(),
  host: os.hostname(), hasGpu, runs, checks: checks.map(({ gates, ...c }) => ({ ...c, gates })), swipe, gates, notes,
  tracks: tracks.map(({ path: _p, ...t }) => t) }, null, 1));   // file names and sha256 only, never the folder or the audio
const keys = Object.keys(METRICS).filter(k => runs.some(r => r.metrics[k] !== undefined && r.metrics[k] !== null));
const vkeys = Object.keys(exp.values);
fs.writeFileSync(path.join(OUT, 'report.md'), `# ${exp.id} · #${PR} @${SHA.slice(0, 7)}\n\n${exp.note ? exp.note + '\n\n' : ''}`
  + `${gates.filter(g => g.ok).length}/${gates.filter(g => !g.skipped).length} gates pass${gates.some(g => g.skipped) ? ` (${gates.filter(g => g.skipped).length} skipped)` : ''} · warm-up ${exp.warmup} s · ${exp.seconds} s per run${swipe ? ` · swipe run \`qa/${swipe.dir}\`` : ''}\n\n`
  + (runs.length ? `| run | ${[...keys, ...vkeys.map(k => 'value.' + k)].join(' | ')} |\n|---|${[...keys, ...vkeys].map(() => '---').join('|')}|\n`
    + runs.map(r => `| ${r.label} | ${[...keys.map(k => r.metrics[k] ?? '—'), ...vkeys.map(k => (JSON.stringify(r.values[k], (_, v) => (typeof v === 'number' ? +v.toPrecision(6) : v)) ?? '—').slice(0, 60))].join(' | ')} |`).join('\n') + '\n\n' : '')
  + gates.map(g => `- ${g.skipped ? 'ℹ️' : g.ok ? '✅' : '❌'} ${g.name}${g.value ? ` · ${g.value}` : ''}`).join('\n') + '\n');
console.log(OUT);
