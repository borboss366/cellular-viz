// No-beat mode QA (the apartment MVP, Task 3): one scene page through three phases, by default 30 s each:
//   1. nobeat-1  confidence forced to 0 (__qa.forceConfidence(0)): the beat weight must fade to 0 within one bar
//   2. locked    the clock's own confidence again (forceConfidence(null)): back to 1 within one bar
//   3. nobeat-2  forced to 0 again
// Per phase: the beat weight and the energy envelopes every frame (from __qa.beatWeight / __qa.energy, which
// audio-in.js defines), the rAF frame intervals, and one still (PNG) at the end for the user's grading: the run folder
// is a grading run (results.json + stills/0N-<phase>.png, gradeRun below), so the viewer's /grade lists it and shows
// one card per phase with keep / maybe / dull.
// Rows: weight at the target one bar (+0.5 s) into each phase; no step larger than the one-bar ramp allows (no pops);
// no NaN in the weight or the energy; the frame budget (rAF interval p95 <= 17.5 ms, the 60 Hz frame); the scene
// alive (no page error, the panic calm fallback never took over, the WebGL context not lost).
// Used by qa/check-nobeat.mjs (the CLI, 780M) and qa/runner/test/nobeat-smoke.test.mjs (the runner, short phases).
import fs from 'node:fs';
import path from 'node:path';

export const PHASES = [{ name: 'nobeat-1', conf: 0, target: 0 }, { name: 'locked', conf: null, target: 1 }, { name: 'nobeat-2', conf: 0, target: 0 }];
export const BUDGET_P95_MS = 17.5;

// installed in the page after load: one rAF callback that records while __nb.on
export const RECORDER = `(() => {
  if (window.__nb) return;
  const nb = window.__nb = { on: false, rec: [], last: null, lost: 0 };
  for (const c of document.querySelectorAll('canvas')) c.addEventListener('webglcontextlost', () => { nb.lost++; });
  const tick = ts => {
    requestAnimationFrame(tick);
    if (!nb.on) { nb.last = ts; return; }
    const q = window.__qa || {}, b = q.beatWeight || null, e = q.energy || null;
    nb.rec.push({ ts, dt: nb.last === null ? null : ts - nb.last, w: b ? b.w : null, target: b ? b.target : null, barS: b ? b.barS : null,
      e: e ? [e.kick, e.level, ...Object.values(e.bands || {})] : null });
    nb.last = ts;
  };
  requestAnimationFrame(tick);
})()`;

const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

/** the rows for one phase's records (pure: node-tested) */
export function phaseRows(rec, { target, secs }) {
  const out = { frames: rec.length, nan: 0, noHelper: 0, maxStep: 0, maxStepAllowed: 0, atTarget: null, settleS: null, p95: null, p99: null, over20: 0, w0: null, w1: null };
  if (!rec.length) return out;
  const t0 = rec[0].ts;
  for (const r of rec) {
    if (r.w === null || r.e === null) { out.noHelper++; continue; }
    if (!Number.isFinite(r.w) || !r.e.every(Number.isFinite)) out.nan++;
  }
  const ok = rec.filter(r => Number.isFinite(r.w));
  for (let i = 1; i < ok.length; i++) {
    const dt = (ok[i].ts - ok[i - 1].ts) / 1000, barS = ok[i].barS > 0 ? ok[i].barS : 2;
    const step = Math.abs(ok[i].w - ok[i - 1].w), allowed = 1.5 * Math.min(1, dt) / barS + 0.01;   // smoothstep's slope is at most 1.5
    if (step - allowed > out.maxStep - out.maxStepAllowed) { out.maxStep = step; out.maxStepAllowed = allowed; }
  }
  const barS = ok.length ? ok[ok.length - 1].barS || 2 : 2;
  const after = ok.filter(r => (r.ts - t0) / 1000 >= barS + 0.5);
  out.atTarget = after.length ? after.every(r => Math.abs(r.w - target) <= 0.001) : null;
  const reach = ok.find(r => Math.abs(r.w - target) <= 0.001);
  out.settleS = reach ? +((reach.ts - t0) / 1000).toFixed(2) : null;
  const dts = rec.map(r => r.dt).filter(Number.isFinite);
  out.p95 = pct(dts, 0.95); out.p99 = pct(dts, 0.99); out.over20 = dts.filter(x => x > 20).length;
  out.w0 = ok.length ? +ok[0].w.toFixed(3) : null; out.w1 = ok.length ? +ok[ok.length - 1].w.toFixed(3) : null;
  out.secs = secs;
  return out;
}

/** run the three phases on a loaded page (Play already pressed); stills into outDir; → { phases: [{ name, rows, still }], alive } */
export async function runNoBeat(page, { phaseSecs = 30, outDir = null, gotoPhase = null } = {}) {
  await page.evaluate(RECORDER);
  const phases = [];
  let lost = 0;
  for (const [i, ph] of PHASES.entries()) {
    // a phase with its own audio (--nobeat-audio): the page is loaded again with that source, then recorded as before
    if (gotoPhase) {
      const before = await page.evaluate(() => (window.__nb ? window.__nb.lost : 0)).catch(() => 0);
      if (await gotoPhase(ph, i)) { lost += before; await page.evaluate(RECORDER); }
    }
    await page.evaluate(c => { window.__qa.forceConfidence(c); window.__nb.rec = []; window.__nb.last = null; window.__nb.on = true; }, ph.conf);
    await page.waitForTimeout(phaseSecs * 1000);
    const rec = await page.evaluate(() => { window.__nb.on = false; return window.__nb.rec; });
    let still = null;
    if (outDir) { const sd = path.join(outDir, 'stills'); fs.mkdirSync(sd, { recursive: true }); still = path.join(sd, stillName(i, ph.name)); await page.screenshot({ path: still }); }
    phases.push({ name: ph.name, target: ph.target, rows: phaseRows(rec, { target: ph.target, secs: phaseSecs }), still });
  }
  await page.evaluate(() => window.__qa.forceConfidence(null));
  const alive = await page.evaluate(() => ({ panic: window.__panic ? window.__panic.mode : null, lost: window.__nb.lost }));
  alive.lost += lost;
  return { phases, alive };
}

// --nobeat-audio <corpus id>[@start-end s]: what the no-beat phases play instead of the metronome (the locked phase
// keeps the page's own clock source). Corpus ids only (R9); the default is born-slippy's beatless intro (the tracker
// locks only at ~116 s).
export const NOBEAT_AUDIO_DEFAULT = 'born-slippy@0-90';
export const NOBEAT_AUDIO_ROUTE = '/nobeat-audio/';
export function parseNobeatAudio(spec = NOBEAT_AUDIO_DEFAULT) {
  if (spec === 'none' || spec === 'metronome') return null;
  const m = /^([a-z0-9][a-z0-9-]*)(?:@(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?))?$/.exec(String(spec));
  if (!m) throw new Error(`--nobeat-audio: a corpus id with an optional @start-end in seconds, like ${NOBEAT_AUDIO_DEFAULT} (got ${spec})`);
  const from = m[2] === undefined ? 0 : +m[2], to = m[3] === undefined ? null : +m[3];
  if (to !== null && !(to > from)) throw new Error(`--nobeat-audio: the end (${to}) must come after the start (${from})`);
  return { id: m[1], from, to };
}
/** the page query for a phase: the no-beat phases play the excerpt through audio-in's file source (its analyser hears
 *  only the excerpt, not the metronome); the locked phase is the base query (the clock's own source) */
export function phaseQuery(base, ph, audio) {
  if (!audio || ph.conf !== 0) return base;
  const extra = `audio=${encodeURIComponent(`file:${NOBEAT_AUDIO_ROUTE}${audio.id}`)}&audioFrom=${audio.from}${audio.to !== null ? `&audioTo=${audio.to}` : ''}`;
  return [base, extra].filter(Boolean).join('&');
}

/** the still's file name, as the viewer looks it up (serve.mjs stillOf: NN-<label>.png in stills/) */
export const stillName = (i, label) => `${String(i + 1).padStart(2, '0')}-${label.replace(/[^\w-]+/g, '-')}.png`;

/** the run folder's results.json for the grading page (qa/serve.mjs): one result per phase, no video, a still each.
 *  meta.gpu decides whether /grade lists it (software renderers are listed under "other runs") */
export function gradeRun({ page, query = '', secs, res, verdictLines = [], pass = null, gpu = '', renderer = '', stamp = '' }) {
  return {
    meta: { exp: page, kind: 'nobeat', gpu, renderer, warm: 3, dur: secs, stamp,
      note: `no-beat mode: one still per phase (confidence 0 / locked / confidence 0, ${secs} s each)${pass === false ? '; a QA row failed, see check.md' : ''}` },
    results: res.phases.map((p, i) => ({
      label: p.name, url: `${page}?${query}`, phase: i + 1, target: p.target, still: `stills/${stillName(i, p.name)}`,
      detail: verdictLines[i] || '', rows: p.rows })),
  };
}

/** the gate per phase and overall; budget optional (report-only on software rendering) */
export function verdict(res, { errors = [], budget = true } = {}) {
  const lines = [];
  let pass = true;
  for (const p of res.phases) {
    const r = p.rows, fails = [];
    if (r.noHelper) fails.push(`no beat weight / energy on ${r.noHelper} frames (the page does not call audio.read()?)`);
    if (r.nan) fails.push(`NaN on ${r.nan} frames`);
    if (r.atTarget !== true) fails.push(`weight not at ${p.target} one bar in (settled ${r.settleS ?? 'never'} s)`);
    if (r.maxStep > r.maxStepAllowed) fails.push(`a step of ${r.maxStep.toFixed(3)} (> ${r.maxStepAllowed.toFixed(3)}: a pop)`);
    const overBudget = !(r.p95 !== null && r.p95 <= BUDGET_P95_MS);
    if (overBudget && budget) fails.push(`frame p95 ${r.p95} ms > ${BUDGET_P95_MS}`);
    if (fails.length) pass = false;
    lines.push(`${p.name}: ${fails.length ? 'FAIL ' + fails.join('; ') : 'pass'} | frames ${r.frames}, w ${r.w0} -> ${r.w1}, settled ${r.settleS ?? '-'} s, frame p95 ${r.p95 ?? '-'} ms p99 ${r.p99 ?? '-'} ms, > 20 ms ${r.over20}${budget ? '' : ' (budget report-only)'}, still ${p.still ? path.basename(p.still) : '-'}`);
  }
  const alive = errors.length === 0 && res.alive.panic !== 'calm' && !res.alive.lost;
  if (!alive) pass = false;
  lines.push(`scene alive: ${alive ? 'pass' : 'FAIL'} (page errors ${errors.length}, panic ${res.alive.panic}, WebGL contexts lost ${res.alive.lost})`);
  return { pass, lines };
}
