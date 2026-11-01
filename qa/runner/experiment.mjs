#!/usr/bin/env node
// The experiment file: what the runner does for one PR, read from qa/experiments/<PR>.json on the PR's head.
// It is data only. The runner, the measuring code and the check scripts never come from the PR (see README.md).
// The format is in qa/experiments/README.md; this file validates it, expands it into runs and turns results into gates.
//
//   node qa/runner/experiment.mjs qa/experiments/57.json     → "ok: 6 runs, 5 gates" or the errors, exit 1
//
// A new debug probe is one entry in probes.mjs; this file only asks probes.mjs whether a debug field is valid.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROBES, readExpr } from './probes.mjs';
import { TRACKS } from './audio.mjs';
export { readExpr };

export const VERSION = 1;
export const NAME_RE = /^\d\d-[a-z0-9-]+$/;                 // qa/<id>/ folder and experiments/<page>.html
const LABEL_RE = /^[A-Za-z0-9][\w.-]{0,39}$/;
const KEY_RE = /^[A-Za-z_][\w.-]{0,39}$/;
const CHECK_RE = /^check-[\w-]+$/;                           // qa/check-NN[-x].mjs on CHECKS_REF
const ARG_RE = /^[\w.=:,+@%/-]{0,200}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/;
export const SIZES = { '720p': [1280, 720], '1080p': [1920, 1080], '1440p': [2560, 1440], '4k': [3840, 2160] };
// measured per run by exp-run.mjs; a gate names one of these or value.<name> from "values"
export const METRICS = {
  fps: 'average frames per second over the record window',
  'fps.p05': 'fps of the 95th-percentile frame time (1000 / p95 ms): the slow end',
  'frameMs.p95': '95th-percentile frame time, ms',
  'frameMs.max': 'longest frame, ms',
  longFrames: '% of frames longer than 20 ms',
  clip: '% of pixels clipped (any channel ≥ 254) in the worst sampled frame',
  'clip.mean': '% clipped pixels, mean over the sampled frames',
  'lum.mean': 'mean luminance of the sampled frames, % of white (Rec. 709 weights on the sRGB values)',
  'lum.min': 'luminance of the darkest sampled frame, %',
  'lum.max': 'luminance of the brightest sampled frame, %',
  errors: 'page errors plus __qa.errors entries',
  gpuBusy: 'GPU busy % read just before the run (outside load)',
  // kind "audio" (#141): from the page's __qa.audioIn.log and the offline analysis of the same excerpt (audiocheck.mjs)
  'audio.deviceOk': '1 when the input the page opened is the route\'s (fake: "fake", loop: "blackhole" in its label)',
  'audio.banner': '1 when the page shows the no-match device banner',
  'audio.levelDuringDb': 'median RMS of the captured waveform while the excerpt plays, dBFS',
  'audio.levelAfterEndDb': 'loudest frame from 0.5 s after a noloop excerpt ends, dBFS',
  'audio.bandDiffDb.max': 'the largest per-band difference of the live band medians from the offline analysis, dB',
  'audio.rowCorr.min': 'the lowest per-row Pearson of a row\'s glow with its band lane (best lag within ±100 ms)',
  'audio.frames': 'frames logged while the excerpt played',
};
export const KINDS = ['render', 'perf', 'audio', 'both'];   // #141: render = CPU (SwiftShader), perf = GPU, audio = a real track as the line input
const TOP = ['$schema', 'version', 'id', 'page', 'note', 'params', 'resolutions', 'warmup', 'seconds', 'play', 'variants', 'sweep',
  'values', 'gates', 'checks', 'record', 'swipe', 'debug', 'timeoutMin', 'kind', 'audio'];
const MAX_RUNS = 64;

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isNum = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const scalar = x => typeof x === 'string' ? x.length <= 200 : typeof x === 'number' ? Number.isFinite(x) : typeof x === 'boolean';
const list = x => (Array.isArray(x) ? x : [x]);

function checkParams(p, where, errs) {
  if (!isObj(p)) return errs.push(`${where}: must be an object of URL settings`);
  for (const [k, v] of Object.entries(p)) {
    if (!KEY_RE.test(k)) errs.push(`${where}: bad setting name "${k}"`);
    if (!scalar(v)) errs.push(`${where}.${k}: must be a string, number or true/false`);
  }
}
function size(r) {
  if (typeof r === 'string') return SIZES[r.toLowerCase()] ? { name: r.toLowerCase(), w: SIZES[r.toLowerCase()][0], h: SIZES[r.toLowerCase()][1] } : null;
  if (Array.isArray(r) && r.length === 2 && r.every(n => Number.isInteger(n) && n >= 320 && n <= 7680)) return { name: `${r[0]}x${r[1]}`, w: r[0], h: r[1] };
  return null;
}

/** Validate a parsed experiment file. Returns {errors: [..], exp} where exp has every default filled in. */
export function validate(raw) {
  const errs = [];
  if (!isObj(raw)) return { errors: ['the file must hold one JSON object'], exp: null };
  for (const k of Object.keys(raw)) if (!TOP.includes(k)) errs.push(`unknown field "${k}" (known: ${TOP.slice(1).join(', ')})`);
  if (raw.version !== VERSION) errs.push(`version must be ${VERSION}`);
  if (typeof raw.id !== 'string' || !NAME_RE.test(raw.id)) errs.push('id must name the qa/ folder, like "18-little-bang"');
  const page = raw.page ?? raw.id;
  if (typeof page !== 'string' || !NAME_RE.test(page)) errs.push('page must name experiments/<page>.html without .html, like "18-little-bang"');
  if (raw.note !== undefined && typeof raw.note !== 'string') errs.push('note must be text');
  const params = raw.params ?? {};
  checkParams(params, 'params', errs);

  const resolutions = raw.resolutions ?? ['1080p'];
  const sizes = [];
  if (!Array.isArray(resolutions) || !resolutions.length) errs.push('resolutions must be a list, like ["1080p", "4k"]');
  else for (const r of resolutions) { const s = size(r); if (!s) errs.push(`resolution ${JSON.stringify(r)}: use ${Object.keys(SIZES).join(', ')} or [width, height]`); else sizes.push(s); }

  const warmup = raw.warmup ?? 4, seconds = raw.seconds ?? 12;
  if (!isNum(warmup, 0, 120)) errs.push('warmup: seconds before measuring, 0–120');
  if (!isNum(seconds, 0, 600)) errs.push('seconds: measured seconds per run, 0–600 (0 = no measured runs, checks only)');
  const play = raw.play ?? true;
  if (typeof play !== 'boolean') errs.push('play must be true or false');

  let variants = [{ name: 'default', params: {} }];
  if (raw.variants !== undefined) {
    if (!Array.isArray(raw.variants) || !raw.variants.length) errs.push('variants must be a non-empty list of {name, params}');
    else variants = raw.variants.map((v, i) => {
      if (!isObj(v) || !LABEL_RE.test(v.name || '')) errs.push(`variants[${i}]: needs a name (letters, digits, . _ -, up to 40)`);
      else checkParams(v.params ?? {}, `variants[${i}].params`, errs);
      return { name: v && v.name, params: (v && v.params) || {} };
    });
    const names = variants.map(v => v.name);
    if (new Set(names).size !== names.length) errs.push('variant names must be unique');
  }
  if (raw.sweep !== undefined) {
    if (!isObj(raw.sweep) || !Object.keys(raw.sweep).length) errs.push('sweep must be an object: setting → list of values');
    else for (const [k, vals] of Object.entries(raw.sweep)) {
      if (!KEY_RE.test(k)) errs.push(`sweep: bad setting name "${k}"`);
      if (!Array.isArray(vals) || !vals.length || vals.length > 12 || !vals.every(scalar)) errs.push(`sweep.${k}: a list of 1–12 values`);
    }
  }

  const values = raw.values ?? {};
  if (!isObj(values)) errs.push('values must be an object: name → expression read from the page, like {"crossings": "__qa.crossings"}');
  else for (const [k, e] of Object.entries(values)) {
    if (!KEY_RE.test(k)) errs.push(`values: bad name "${k}"`);
    if (typeof e !== 'string' || !e.trim() || e.length > 500) errs.push(`values.${k}: a JavaScript expression, up to 500 characters`);
  }

  const gates = raw.gates ?? [];
  if (!Array.isArray(gates)) errs.push('gates must be a list');
  else gates.forEach((g, i) => {
    const w = `gates[${i}]`;
    if (!isObj(g)) return errs.push(`${w}: must be an object like {"metric": "fps.p05", "min": 60}`);
    for (const k of Object.keys(g)) if (!['metric', 'min', 'max', 'equals', 'variant', 'resolution', 'name', 'track', 'report'].includes(k)) errs.push(`${w}: unknown field "${k}"`);
    if (g.report !== undefined && typeof g.report !== 'boolean') errs.push(`${w}.report: true (a report-only row, never a fail) or false`);
    if (g.track !== undefined && !TRACKS.includes(g.track)) errs.push(`${w}.track: one of ${TRACKS.join(', ')} (a real track in QA_AUDIO_DIR; the gate is skipped when it is missing)`);
    const m = g.metric;
    const known = typeof m === 'string' && (METRICS[m] || (m.startsWith('value.') && isObj(values) && m.slice(6) in values));
    if (!known) errs.push(`${w}: metric "${m}" is not measured (${Object.keys(METRICS).join(', ')}, or value.<name> from values)`);
    if (g.min === undefined && g.max === undefined && g.equals === undefined) errs.push(`${w}: needs min, max or equals`);
    for (const k of ['min', 'max']) if (g[k] !== undefined && !isNum(g[k], -1e12, 1e12)) errs.push(`${w}.${k}: a number`);
    if (g.equals !== undefined && !scalar(g.equals)) errs.push(`${w}.equals: a string, number or true/false`);
    if (g.variant !== undefined && !list(g.variant).every(n => typeof n === 'string')) errs.push(`${w}.variant: a variant name or a list of them`);
    if (g.resolution !== undefined && !list(g.resolution).every(r => size(r))) errs.push(`${w}.resolution: a resolution or a list of them`);
    if (g.name !== undefined && (typeof g.name !== 'string' || g.name.length > 120)) errs.push(`${w}.name: text up to 120 characters`);
  });

  const rawChecks = raw.checks ?? [];
  if (!Array.isArray(rawChecks)) errs.push('checks must be a list, like ["check-18"]');
  const checks = (Array.isArray(rawChecks) ? rawChecks : []).map((c, i) => {
    const o = typeof c === 'string' ? { script: c, args: [] } : isObj(c) ? { script: c.script, args: c.args ?? [] } : null;
    if (!o) { errs.push(`checks[${i}]: a script name like "check-18" or {"script": "check-18", "args": [..]}`); return null; }
    o.script = String(o.script || '').replace(/\.mjs$/, '');
    if (!CHECK_RE.test(o.script)) errs.push(`checks[${i}]: "${o.script}" must be a qa/check-*.mjs name, like "check-18"`);
    if (!Array.isArray(o.args) || !o.args.every(a => typeof a === 'string' && ARG_RE.test(a) && !a.includes('..'))) errs.push(`checks[${i}].args: a list of plain arguments (no spaces, no ..)`);
    return o;
  }).filter(Boolean);

  const record = { stills: 1, ...(isObj(raw.record) ? raw.record : {}) };
  if (raw.record !== undefined && !isObj(raw.record)) errs.push('record must be an object like {"stills": 1}');
  for (const k of Object.keys(record)) if (k !== 'stills') errs.push(`record: unknown field "${k}"`);
  if (!Number.isInteger(record.stills) || record.stills < 0 || record.stills > 4) errs.push('record.stills: 0–4 stills per run');

  let swipe = null;
  if (raw.swipe !== undefined && raw.swipe !== false) {
    const s = raw.swipe === true ? {} : raw.swipe;
    if (!isObj(s)) errs.push('swipe must be true or an object like {"vs": "2ed06a0"}');
    else {
      for (const k of Object.keys(s)) if (!['vs', 'seconds', 'warmup', 'variants'].includes(k)) errs.push(`swipe: unknown field "${k}"`);
      const vs = s.vs ?? null;
      if (vs !== null && vs !== 'base' && !(typeof vs === 'string' && SHA_RE.test(vs))) errs.push('swipe.vs: an older commit (7–40 hex) or "base" (where the PR left main)');
      const sv = s.variants ?? variants.map(v => v.name);
      if (!Array.isArray(sv) || !sv.length || !sv.every(n => variants.some(v => v.name === n))) errs.push('swipe.variants: names from variants');
      if (s.seconds !== undefined && !isNum(s.seconds, 1, 300)) errs.push('swipe.seconds: 1–300');
      if (s.warmup !== undefined && !isNum(s.warmup, 0, 120)) errs.push('swipe.warmup: 0–120');
      swipe = { vs, seconds: s.seconds ?? 40, warmup: s.warmup ?? 4, variants: Array.isArray(sv) ? sv : [] };
    }
  }

  const debug = raw.debug ?? {};
  if (!isObj(debug)) errs.push('debug must be an object: probe → its setting');
  else for (const [k, v] of Object.entries(debug)) {
    const p = PROBES[k];
    if (!p) { errs.push(`debug: unknown probe "${k}" (known: ${Object.keys(PROBES).join(', ')}); a new probe is a small runner PR`); continue; }
    const e = p.check(v);
    if (e) errs.push(`debug.${k}: ${e}`);
  }
  const timeoutMin = raw.timeoutMin ?? null;
  if (timeoutMin !== null && !isNum(timeoutMin, 1, 600)) errs.push('timeoutMin: 1–600');

  // #141: what the run checks, and for kind "audio" the track excerpt the page hears as its line input
  const kind = raw.kind ?? 'both';
  if (!KINDS.includes(kind)) errs.push(`kind: one of ${KINDS.join(', ')}`);
  let audio = null;
  if (raw.audio !== undefined || kind === 'audio') {
    const a = raw.audio;
    if (kind !== 'audio') errs.push('audio: only with kind "audio"');
    else if (!isObj(a)) errs.push('audio: {"track": "<name>", "from": s, "len": s, "noloop": true, "via": "fake"} for kind "audio"');
    else {
      for (const k of Object.keys(a)) if (!['track', 'from', 'len', 'noloop', 'via'].includes(k)) errs.push(`audio: unknown field "${k}"`);
      audio = { track: a.track, from: a.from ?? 0, len: a.len, noloop: a.noloop ?? true, via: a.via ?? 'fake' };
      if (!TRACKS.includes(audio.track)) errs.push(`audio.track: one of ${TRACKS.join(', ')} (in QA_AUDIO_DIR; the runs are skipped when it is missing)`);
      if (!Number.isInteger(audio.from) || audio.from < 0 || audio.from > 3600) errs.push('audio.from: whole seconds into the track, 0–3600');
      if (!Number.isInteger(audio.len) || audio.len < 2 || audio.len > 120) errs.push('audio.len: whole seconds of excerpt, 2–120');
      if (typeof audio.noloop !== 'boolean') errs.push('audio.noloop: true or false');
      if (audio.via === 'loop') errs.push('audio.via "loop" needs qa/audio-loop.sh (the next runner PR); use "fake" for now');
      else if (audio.via !== 'fake') errs.push('audio.via: "fake" (Chromium fake capture) or "loop" (PulseAudio BlackHole-QA)');
      // a noloop excerpt is checked for silence after its end, so the run has to outlast it (it starts with Play)
      if (audio.noloop && Number.isInteger(audio.len) && isNum(warmup, 0, 120) && isNum(seconds, 0, 600) && warmup + seconds < audio.len + 1.5)
        errs.push(`audio: warmup + seconds (${warmup + seconds}) must reach 1.5 s past the excerpt's end (len ${audio.len}) to check the silence after it`);
    }
  }

  const exp = { version: VERSION, id: raw.id, page, note: raw.note || '', params, sizes, warmup, seconds, play, variants, sweep: raw.sweep || null,
    values: isObj(values) ? values : {}, gates: Array.isArray(gates) ? gates : [], checks, record, swipe, debug: isObj(debug) ? debug : {}, timeoutMin, kind, audio };
  if (!errs.length) {
    const n = expand(exp).length;
    if (n > MAX_RUNS) errs.push(`${n} runs (variants × sweep × resolutions); keep it to ${MAX_RUNS}`);
    if (exp.gates.length && !exp.seconds) errs.push('gates need measured runs: set seconds > 0');
  }
  return { errors: errs, exp };
}

/** variants × sweep combos (each a variant), then × resolutions → [{label, variant, size, params}] */
export function variantsOf(exp) {
  let out = exp.variants.map(v => ({ name: v.name, params: { ...v.params } }));
  if (exp.sweep) for (const [k, vals] of Object.entries(exp.sweep)) {
    out = out.flatMap(v => vals.map(x => ({ name: `${v.name === 'default' && exp.variants.length === 1 ? '' : v.name + '_'}${k}-${x}`.replace(/[^\w.-]+/g, '-'), base: v.base || v.name, params: { ...v.params, [k]: x } })));
  }
  return out.map(v => ({ ...v, base: v.base || v.name }));
}
export function expand(exp) {
  const out = [];
  for (const v of variantsOf(exp)) for (const s of exp.sizes)
    out.push({ label: `${v.name}@${s.name}`, variant: v.name, base: v.base, size: s, params: { ...exp.params, ...v.params } });
  return out;
}
export const query = params => new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

/** metric value of one run result ({metrics, values}) */
export function metricOf(run, m) { return m.startsWith('value.') ? run.values?.[m.slice(6)] : run.metrics?.[m]; }

/**
 * gates against measured runs: [{name, ok, value}] (value: the worst run). missing: track names absent from
 * QA_AUDIO_DIR. A gate with a missing track, or whose runs were all skipped for one, is {ok: null, skipped: true}:
 * a report-only row, never a fail.
 */
export function evalGates(exp, runs, { missing = [] } = {}) {
  return exp.gates.map(g => {
    const vs = g.variant === undefined ? null : list(g.variant), rs = g.resolution === undefined ? null : list(g.resolution).map(r => size(r).name);
    const matched = runs.filter(r => (!vs || vs.includes(r.variant) || vs.includes(r.base)) && (!rs || rs.includes(r.size.name)));
    const mine = matched.filter(r => !r.skipped);
    const bar = [g.min !== undefined && `≥ ${g.min}`, g.max !== undefined && `≤ ${g.max}`, g.equals !== undefined && `= ${g.equals}`].filter(Boolean).join(' ');
    const name = g.name || `${g.metric} ${bar}${vs ? ` (${vs.join(', ')})` : ''}${rs ? ` @${rs.join(', ')}` : ''}`;
    if (g.track && missing.includes(g.track)) return { name, ok: null, skipped: true, value: `skipped: track missing (${g.track})` };
    if (exp.audio && missing.includes(exp.audio.track) && g.metric.startsWith('audio.')) return { name, ok: null, skipped: true, value: `skipped: track missing (${exp.audio.track})` };
    if (!mine.length && matched.length) return { name, ok: null, skipped: true, value: `skipped: track missing (${[...new Set(matched.map(r => r.skipped))].join(', ')})` };
    if (!mine.length) return { name, ok: false, value: 'no run matches this gate' };
    const fails = [], seen = [];
    for (const r of mine) {
      const x = metricOf(r, g.metric);
      seen.push(`${r.label} ${typeof x === 'number' ? +x.toFixed(3) : JSON.stringify(x)}`);
      const bad = x === undefined || x === null || (typeof x === 'number' && Number.isNaN(x))
        || (g.min !== undefined && !(x >= g.min)) || (g.max !== undefined && !(x <= g.max)) || (g.equals !== undefined && x !== g.equals);
      if (bad) fails.push(r.label);
    }
    const value = (fails.length ? `fails on ${fails.join(', ')} · ` : '') + seen.join(' · ');
    // report: true (an audio gate in its first week, #141): shown as a note with what it would say, never a fail
    if (g.report) return { name: `${name} (report-only)`, ok: null, skipped: true, value: `${fails.length ? 'would fail' : 'would pass'} · ${value}` };
    return { name, ok: !fails.length, value };
  });
}

/** gates from a check script's check.md (same rules as qa/builds.mjs gatesFromCheck) */
export function gatesFromMd(md) {
  const gates = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\| (.+?) \| (✅|❌)[^|]*\|(.*)\|$/);
    if (m) { gates.push({ name: m[1].trim(), ok: m[2] === '✅', value: m[3].trim() }); continue; }
    const l = line.match(/^- (✅|❌) (\S.*)$/);
    if (l) gates.push({ name: l[2].trim(), ok: l[1] === '✅', value: '' });
  }
  return gates;
}
const cell = s => String(s ?? '').replace(/[|\n\r]/g, ' ').slice(0, 280);
/** check.md that qa/builds.mjs finish reads: | gate | ✅/❌ | detail |, ℹ️ rows are notes */
export function checkMd(title, gates, notes = []) {
  return `# ${title}\n\n| gate | result | detail |\n|---|---|---|\n`
    + gates.map(g => `| ${cell(g.name)} | ${g.skipped ? 'ℹ️' : g.ok ? '✅' : '❌'} | ${cell(g.value)} |`).join('\n')
    + (notes.length ? '\n' + notes.map(([k, v]) => `| ${cell(k)} | ℹ️ | ${cell(v)} |`).join('\n') : '') + '\n';
}

export function loadFile(file) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { errors: [`${path.basename(file)} is not valid JSON: ${e.message}`], exp: null }; }
  return validate(raw);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node qa/runner/experiment.mjs qa/experiments/<PR>.json'); process.exit(2); }
  const { errors, exp } = loadFile(file);
  if (errors.length) { for (const e of errors) console.error('✗ ' + e); process.exit(1); }
  console.log(`ok: ${exp.id}, ${expand(exp).length} runs, ${exp.gates.length} gates, ${exp.checks.length} checks${exp.swipe ? ', swipe' : ''}`);
}
