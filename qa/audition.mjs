// The audition page's rules (docs/CELLULAR_VIZ_BRIEF_SET_RELEASE.md Task 1): which pages are scenes, the facts the
// repo and the box's check results already hold about each, the controller's next / previous buttons and the user's
// verdicts. Pure and browser-safe: experiments/audition.html imports it through conduct-serve (BROWSER_MODULES), and
// conduct-serve's GET /api/audition uses it on the files it reads. Nothing here ranks or scores a scene: the verdict
// is the user's. A fact the files do not hold is 'unknown', never a guess.
//
//   isScenePage(file, src)     a scene: NN-name.html in experiments/ that loads panic.js (every scene obeys the panic
//                              key and the conductor's panic; the tool pages, conductor, set, setup-check, do not)
//   hasNoBeat(src)             'yes' when the page has no-beat mode (its code names it: "no-beat" / NoBeat), else 'no'
//   parseControls(src)         the knobs and buttons its header declares ("Controls (#85):" or "Controller (#85):":
//                              macroN <name>, "Triggers: N <name>"), or null (none declared)
//   checkRows(md)              a check.md table -> [{ gate, result: 'pass' | 'fail' | 'info', detail }]
//   beatMatchOf(rows)          the shared check's beat-match row -> { value: 'pass' | 'fail' | 'not measured', detail }
//   frameOf(rows, size)        a frame-time row for that size ('1080p', '1440p', p95) -> { value, gate, detail } or null
//   sceneUrl(page)             the scene with the set defaults (clock=shared, audio=line, in=BlackHole)
//   midiStep(data)             a controller message -> +1 (next, top button 6, CC 42), -1 (previous, top button 5,
//                              CC 41), 0 (anything else). Top buttons 1 and 2 (CC 37, 38) are hold and auto-hold
//                              (#239); 3 / 4 and 7 / 8 step the slot windows (20 Nov: one half of the device per slot)
//   checkVerdicts(obj)         the saved file's problems ([] when it is good)
//   keepCount / keepOnly       the count of keeps (target AUDITION_TARGET) and the keep filter
export const AUDITION_TARGET = 7;
export const VERDICTS = ['keep', 'maybe', 'drop'];
export const AUDITION_RE = /^audition-\d{8}-\d{6}$/;
export const SCENE_FILE = /^\d{2}-[a-z0-9-]+\.html$/;
export const SET_DEFAULTS = { clock: 'shared', audio: 'line', in: 'BlackHole' };
export const BUTTON_STATUS = 0xB0, PREV_CC = 41, NEXT_CC = 42;
export const NOTE_MAX = 500;

export const isScenePage = (file, src) => SCENE_FILE.test(String(file)) && /<script src="panic\.js"><\/script>/.test(String(src || ''));
export const hasNoBeat = src => (/no-beat|NoBeat/.test(String(src || '')) ? 'yes' : 'no');
export function titleOf(src) {
  const m = /<title>([^<]*)<\/title>/i.exec(String(src || ''));
  return m ? m[1].trim() : null;
}

/** the header's control block -> { knobs: [{ n, name }], buttons: [{ n, name }] }, or null when none is declared */
export function parseControls(src) {
  const s = String(src || '');
  const at = s.search(/Control(?:s|ler) \(#85\):/);
  if (at < 0) return null;
  // the block ends at the QA hooks line, a blank line or the end of the comment
  const rest = s.slice(at);
  const end = rest.search(/window\.__qa|\n\s*\n|-->|\*\//);
  const block = (end < 0 ? rest : rest.slice(0, end)).replace(/\s+/g, ' ');
  const clean = t => toAscii(t).replace(/\s+/g, ' ').trim().replace(/[;:]$/, '');
  const knobs = [], seenK = new Set();
  for (const m of block.matchAll(/macro([1-8]) ((?:[^,(;.]|\.(?=\d))+)/g)) {
    if (seenK.has(m[1])) continue;
    seenK.add(m[1]); knobs.push({ n: +m[1], name: clean(m[2]).slice(0, 40) });
  }
  // the triggers run to "; keys" (or a sentence end): their own notes in brackets may hold a ";" (24: "hold = bigger; was cells")
  const buttons = [], tr = /Triggers?: (.*?)(?:; keys|\. [A-Z]|$)/.exec(block);
  if (tr) {
    const seenB = new Set();
    for (const m of tr[1].matchAll(/(?:^|, )([1-8]) ([^,(;]+)/g)) {
      if (seenB.has(m[1])) continue;
      seenB.add(m[1]); buttons.push({ n: +m[1], name: clean(m[2]).slice(0, 40) });
    }
  }
  return knobs.length || buttons.length ? { knobs, buttons } : null;
}
/** the page text stays plain ASCII (#205): arrows, dashes, dots and halves as ASCII, anything else dropped */
export function toAscii(t) {
  const map = { '\u2192': '->', '\u2013': '-', '\u2014': '-', '\u00b7': '.', '\u00bd': '1/2', '\u00d7': 'x', '\u2265': '>=', '\u2264': '<=', '\u00b0': ' deg' };
  return String(t).replace(/[^\x20-\x7e]/g, c => map[c] ?? '');
}
/** the controls as one line for the page */
export function controlsText(c) {
  if (!c) return 'none declared';
  const k = c.knobs.map(x => `macro${x.n} ${x.name}`).join(', '), b = c.buttons.map(x => `${x.n} ${x.name}`).join(', ');
  return [k && `knobs: ${k}`, b && `buttons: ${b}`].filter(Boolean).join('; ');
}

/** a check.md (| gate | result | detail |) -> its rows */
export function checkRows(md) {
  const out = [];
  for (const line of String(md || '').split('\n')) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/.exec(line);   // three-column rows only
    if (!m || m[1] === 'gate' || /^-+$/.test(m[1])) continue;
    const r = m[2];
    const result = r.includes('\u2705') ? 'pass' : (r.includes('\u274c') ? 'fail' : 'info');
    out.push({ gate: m[1], result, detail: m[3] });
  }
  return out;
}
/** the beat-match row of a shared check (check-shared.mjs: 'beat match: every clock hit drawn in the first frame ...') */
export function beatMatchOf(rows) {
  const r = (rows || []).find(x => /^beat match\b/.test(x.gate));
  if (!r) return null;
  return { value: r.result === 'info' ? 'not measured' : r.result, detail: r.detail };
}
/** a frame-time row for one size: the gate names the size and a p95 (e.g. '1080p p95 <= 16.8 ms (hard)') */
export function frameOf(rows, size) {
  const r = (rows || []).find(x => x.gate.includes(size) && /p95/.test(x.gate));
  return r ? { value: r.result, gate: r.gate, detail: r.detail } : null;
}

export function sceneUrl(page, defaults = SET_DEFAULTS) {
  if (!SCENE_FILE.test(String(page))) throw new Error(`not a scene page: ${page}`);
  const q = Object.entries(defaults).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return q.length ? `${page}?${q.join('&')}` : page;
}
/** a MIDI message from the controller's DAW port -> +1 next, -1 previous, 0 nothing (a press only, not the release) */
export function midiStep(data) {
  if (!data || data.length < 3) return 0;
  const [st, cc, v] = data;
  if (st !== BUTTON_STATUS || !(v > 0)) return 0;
  return cc === NEXT_CC ? 1 : (cc === PREV_CC ? -1 : 0);
}
/** the index after a step, wrapping around the list */
export const stepIndex = (i, n, d) => (n > 0 ? (((i + d) % n) + n) % n : -1);

/** the verdict file ({ version: 1, stamp, at, verdicts: { page: { verdict, note } } }) -> its problems */
export function checkVerdicts(obj) {
  const errs = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['not an object'];
  if (obj.version !== 1) errs.push('version must be 1');
  if (!AUDITION_RE.test(String(obj.stamp))) errs.push('stamp must look like audition-YYYYMMDD-HHMMSS');
  const v = obj.verdicts;
  if (!v || typeof v !== 'object' || Array.isArray(v)) { errs.push('verdicts must be an object'); return errs; }
  for (const [page, x] of Object.entries(v)) {
    if (!SCENE_FILE.test(page)) { errs.push(`${page}: not a scene page name`); continue; }
    if (!x || typeof x !== 'object') { errs.push(`${page}: must be an object`); continue; }
    if (x.verdict !== null && x.verdict !== undefined && !VERDICTS.includes(x.verdict)) errs.push(`${page}: verdict must be keep, maybe or drop`);
    if (x.note !== undefined && (typeof x.note !== 'string' || x.note.length > NOTE_MAX)) errs.push(`${page}: note must be text of at most ${NOTE_MAX} characters`);
  }
  return errs;
}
export const keepCount = verdicts => Object.values(verdicts || {}).filter(x => x && x.verdict === 'keep').length;
export const keepOnly = (scenes, verdicts) => scenes.filter(s => verdicts && verdicts[s.page] && verdicts[s.page].verdict === 'keep');
/** audition-YYYYMMDD-HHMMSS (local time) */
export function auditionStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `audition-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
