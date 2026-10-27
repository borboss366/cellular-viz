// Debug probes: what QA box may ask for in an experiment file's "debug" field instead of probing the box by hand.
// One probe = one entry here. Adding a probe is a small runner PR that touches only this file (and the format doc).
//
//   check(value)  → null if the setting is valid, else what is wrong (experiment.mjs calls it when validating)
//   init(ctx)     before the page loads (listeners, init scripts)
//   start(ctx)    when the measured window starts (after warm-up)
//   tick(ctx)     about 4 times a second during the window; ctx.t = seconds since start
//   end(ctx)      when the window ends; ctx.frames = the frame times (ms) it measured
//   done(ctx)     before the page closes
// ctx: {page, browser, run: {label, variant, size, params}, value (the setting), state ({} per run), shared ({} per experiment),
//       t, frames, write(name, data) → a file in the run folder's debug/, path(name) → that file's path, note(text) → the report}
import { readGpuBusy } from './gpu.mjs';

/** JS that reads one page expression as plain JSON (undefined → null, a throw → 'error: …'); it runs inside the page */
export const readExpr = e => `(() => { try { const v = (${e}\n); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } catch (err) { return 'error: ' + err.message; } })()`;

const isNums = (v, lo, hi, n = 20) => Array.isArray(v) && v.length > 0 && v.length <= n && v.every(x => typeof x === 'number' && x >= lo && x <= hi);
const safe = s => String(s).replace(/[^\w.@-]+/g, '-');

// a hook after the page's own requestAnimationFrame callbacks, so a canvas copy sees the frame the page just drew
const AFTER_DRAW = `(() => {
  if (window.__probe) return;
  const P = window.__probe = { frame: 0, last: -1, after: [] };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { try { cb(t); } finally {
    if (t !== P.last) { P.last = t; P.frame++; }
    for (const f of P.after) try { f(P.frame, t); } catch (e) {} } });
})();`;

export const PROBES = {
  console: {
    about: 'every console message and page error of the run → debug/<run>-console.log',
    check: v => (v === true ? null : 'true'),
    init(ctx) {
      ctx.state.lines = [];
      const t0 = Date.now(), add = s => ctx.state.lines.push(`[${((Date.now() - t0) / 1000).toFixed(2)}s] ${s}`);
      ctx.page.on('console', m => add(`${m.type()}: ${m.text()}`));
      ctx.page.on('pageerror', e => add(`pageerror: ${e.stack || e.message}`));
      ctx.page.on('requestfailed', r => add(`requestfailed: ${r.url()}`));
    },
    done(ctx) { ctx.write(`${safe(ctx.run.label)}-console.log`, ctx.state.lines.join('\n') + '\n'); },
  },

  screenshotAt: {
    about: 'screenshots at these seconds into the measured window, e.g. [2, 8] → debug/<run>-t2.png',
    check: v => (isNums(v, 0, 600) ? null : 'a list of up to 20 times in seconds, like [2, 8]'),
    start(ctx) { ctx.state.todo = [...ctx.value].sort((a, b) => a - b); },
    async tick(ctx) {
      while (ctx.state.todo.length && ctx.t >= ctx.state.todo[0]) {
        const s = ctx.state.todo.shift();
        await ctx.page.screenshot({ path: ctx.path(`${safe(ctx.run.label)}-t${s}.png`) }).catch(e => ctx.note(`screenshotAt ${s}: ${e.message}`));
      }
    },
  },

  screenshotAtFrame: {
    about: 'the canvas exactly at these frame numbers since load, e.g. [120] → debug/<run>-f120.png',
    check: v => (Array.isArray(v) && v.length && v.length <= 20 && v.every(n => Number.isInteger(n) && n >= 1 && n <= 1e6) ? null : 'a list of up to 20 frame numbers, like [120, 600]'),
    async init(ctx) {
      await ctx.page.addInitScript(AFTER_DRAW);
      await ctx.page.addInitScript(want => {
        const P = window.__probe; P.shots = {};
        P.after.push(n => {
          if (!want.includes(n) || P.shots[n]) return;
          const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
          if (!gl) return;
          const c = document.createElement('canvas'); c.width = gl.width; c.height = gl.height;
          c.getContext('2d').drawImage(gl, 0, 0); P.shots[n] = c.toDataURL('image/png');
        });
      }, ctx.value);
    },
    async done(ctx) {
      const shots = await ctx.page.evaluate(() => window.__probe && window.__probe.shots || {}).catch(() => ({}));
      for (const n of ctx.value) {
        if (shots[n]) ctx.write(`${safe(ctx.run.label)}-f${n}.png`, Buffer.from(shots[n].split(',')[1], 'base64'));
        else ctx.note(`screenshotAtFrame: frame ${n} not reached`);
      }
    },
  },

  gpu: {
    about: 'WebGL vendor/renderer/limits and chrome://gpu, once per experiment → debug/gpu.json',
    check: v => (v === true ? null : 'true'),
    async start(ctx) {
      if (ctx.shared.gpuDone) return;
      ctx.shared.gpuDone = true;
      const webgl = await ctx.page.evaluate(() => {
        const g = document.createElement('canvas').getContext('webgl2');
        if (!g) return { webgl2: false };
        const d = g.getExtension('WEBGL_debug_renderer_info');
        return { webgl2: true, vendor: g.getParameter(d ? d.UNMASKED_VENDOR_WEBGL : g.VENDOR), renderer: g.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : g.RENDERER),
          maxTexture: g.getParameter(g.MAX_TEXTURE_SIZE), maxRenderbuffer: g.getParameter(g.MAX_RENDERBUFFER_SIZE), extensions: g.getSupportedExtensions() };
      }).catch(e => ({ error: e.message }));
      let gpuPage = '';
      try { const p = await ctx.browser.newPage(); await p.goto('chrome://gpu'); await p.waitForTimeout(1500); gpuPage = await p.evaluate(() => document.body.innerText); await p.close(); } catch (e) { gpuPage = 'chrome://gpu: ' + e.message; }
      ctx.write('gpu.json', JSON.stringify({ chromium: ctx.browser.version(), webgl, chromeGpu: gpuPage.slice(0, 200000) }, null, 1));
    },
  },

  frameTimes: {
    about: 'every frame time (ms) of the measured window → debug/<run>-frames.json',
    check: v => (v === true ? null : 'true'),
    end(ctx) { ctx.write(`${safe(ctx.run.label)}-frames.json`, JSON.stringify(ctx.frames)); },
  },

  qaDump: {
    about: 'page expressions sampled during the window, e.g. {"every": 0.5, "read": {"cam": "__qa.camera(__qa.bars)"}} → debug/<run>-qa.jsonl',
    check: v => (v && typeof v === 'object' && typeof v.every === 'number' && v.every >= 0.1 && v.every <= 60 && v.read && typeof v.read === 'object'
      && Object.keys(v.read).length && Object.values(v.read).every(e => typeof e === 'string' && e.length <= 500) ? null
      : '{"every": seconds 0.1–60, "read": {name: expression}}'),
    start(ctx) { ctx.state.lines = []; ctx.state.next = 0; },
    async tick(ctx) {
      if (ctx.t < ctx.state.next) return;
      ctx.state.next = ctx.t + ctx.value.every;
      const row = { t: +ctx.t.toFixed(2) };
      for (const [k, e] of Object.entries(ctx.value.read)) row[k] = await ctx.page.evaluate(readExpr(e)).catch(err => 'error: ' + err.message);
      ctx.state.lines.push(JSON.stringify(row));
    },
    end(ctx) { ctx.write(`${safe(ctx.run.label)}-qa.jsonl`, ctx.state.lines.join('\n') + '\n'); },
  },

  gpuBusy: {
    about: 'GPU busy % sampled during the window, e.g. {"every": 1} → debug/<run>-gpu-busy.jsonl',
    check: v => (v && typeof v === 'object' && typeof v.every === 'number' && v.every >= 0.25 && v.every <= 60 ? null : '{"every": seconds 0.25–60}'),
    start(ctx) { ctx.state.lines = []; ctx.state.next = 0; },
    tick(ctx) {
      if (ctx.t < ctx.state.next) return;
      ctx.state.next = ctx.t + ctx.value.every;
      ctx.state.lines.push(JSON.stringify({ t: +ctx.t.toFixed(2), busy: readGpuBusy() }));
    },
    end(ctx) { ctx.write(`${safe(ctx.run.label)}-gpu-busy.jsonl`, ctx.state.lines.join('\n') + '\n'); },
  },

  trace: {
    about: 'a Chromium performance trace of the window (open in chrome://tracing or Perfetto) → debug/<run>-trace.json',
    check: v => (v === true ? null : 'true'),
    async start(ctx) { await ctx.browser.startTracing(ctx.page, { screenshots: false, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'gpu', 'viz', 'blink'] }); ctx.state.on = true; },
    async end(ctx) { if (ctx.state.on) ctx.write(`${safe(ctx.run.label)}-trace.json`, await ctx.browser.stopTracing()); },
  },
};

export const describe = () => Object.entries(PROBES).map(([k, p]) => `${k}: ${p.about}`);
