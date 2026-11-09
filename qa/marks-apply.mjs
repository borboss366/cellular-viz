#!/usr/bin/env node
// Marks from a conductor session into the committed files (#188 R13, VIZ research 6728993586): the page logs every
// key-M mark (schema v1 `mark`, snapped to a reference beat by qa/marks.mjs); this merges the last mark of each name per
// track into
//   qa/mixes.json   `bar1` → bar1At (seconds) on every mix side of that track that has a bar1At (mode A)
//   qa/corpus.json  any other name → row.markAt[name] = { beat, atMs, rawMs, markSource } (row.marks lists the names
//                   the scorer expects; a mark outside that list is applied and warned about)
// and leaves the diff FOR THE USER TO COMMIT: it never runs git. Tracks by corpus id only (R9): a track record's `id`, or
// its file stem through the box's corpus-map.json; no file name reaches either file or the output.
// The files are edited line by line (one corpus row per line, one mix side per line), so the diff shows only the rows
// that changed.
//
//   node qa/marks-apply.mjs <session.jsonl> [--dir <tracks dir>] [--write]
//     without --write it prints what would change; --dir re-fits each mark's time on that track's grid (same beat)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLog } from './conduct-score.mjs';
import { BAR1, MARK_NAME, beatTimes, fittedBeatMs } from './marks.mjs';

// Shift+S on the conductor page (A7b): a `barOk` mark = "the bar lamp showed on the 1". It belongs to the track's grid
// (barOk on the box's sidecar), not to corpus.json, so it is only reported here.
export const BAR_OK = 'barOk';
export const barOkLines = marks => marks.filter(m => m.name === BAR_OK).map(m => `grid ${m.id}: barOk confirmed with Shift+S on beat ${m.beat} (set barOk: true in its sidecar on the box)`);

export const CORPUS_FILE = fileURLToPath(new URL('./corpus.json', import.meta.url));
export const MIXES_FILE = fileURLToPath(new URL('./mixes.json', import.meta.url));
const num = x => typeof x === 'number' && Number.isFinite(x);
const stemOf = f => path.basename(String(f)).replace(/\.[^.]+$/, '');

/**
 * session records → the last mark of each name per corpus id: [{ id, name, beat, atMs, rawMs, markSource }], plus the
 * problems (a mark whose track has no id, a bad name). idOfStem: stem → corpus id (the inverted corpus-map), optional.
 */
export function marksFromLog(records, { idOfStem = {} } = {}) {
  const recs = records.map((r, i) => [r, i]).sort((x, y) => x[0].ctx - y[0].ctx || x[1] - y[1]).map(x => x[0]);
  const idOfIdx = new Map(), problems = [], last = new Map();
  for (const r of recs) {
    if (r.type === 'track') {
      const id = r.id || (r.file ? idOfStem[stemOf(r.file)] : null);
      if (id) idOfIdx.set(r.idx, id);
      continue;
    }
    if (r.type !== 'mark') continue;
    const id = idOfIdx.get(r.idx);
    if (!id) { problems.push(`mark ${r.name} on track ${r.idx}: no corpus id for that track`); continue; }
    if (!MARK_NAME.test(String(r.name))) { problems.push(`mark "${r.name}" on ${id}: not a mark name`); continue; }
    const atMs = num(r.atMs) ? r.atMs : r.trackMs;
    if (!num(atMs)) { problems.push(`mark ${r.name} on ${id}: no time`); continue; }
    last.set(`${id}\u0000${r.name}`, { id, name: r.name, beat: Number.isInteger(r.beat) ? r.beat : null, atMs, rawMs: num(r.rawMs) ? r.rawMs : null,
      markSource: r.markSource === 'typed' ? 'typed' : 'key' });
  }
  return { marks: [...last.values()], problems };
}

/** re-fit each mark's time on its track's grid (the beat index stays; [ / ] steps are kept) */
export function refit(marks, gridOf) {
  return marks.map(m => {
    const g = gridOf(m.id);
    if (!g || !Number.isInteger(m.beat)) return m;
    const ms = beatTimes(g);
    return m.beat < ms.length ? { ...m, atMs: Math.round(fittedBeatMs(ms, m.beat) * 10) / 10 } : m;
  });
}

/** qa/corpus.json text + marks → { text, changes, warnings } (bar1 marks are left to the mixes) */
export function applyToCorpus(text, marks) {
  const lines = String(text).split('\n'), changes = [], warnings = [];
  for (const m of marks.filter(x => x.name !== BAR1 && x.name !== BAR_OK)) {
    const i = lines.findIndex(l => l.trim().startsWith(`{"id":${JSON.stringify(m.id)},`));
    if (i < 0) { warnings.push(`${m.id}: not a corpus.json row; ${m.name} not applied`); continue; }
    const comma = lines[i].trimEnd().endsWith(','), row = JSON.parse(lines[i].trim().replace(/,$/, ''));
    if (!(row.marks || []).includes(m.name)) warnings.push(`${m.id}: ${m.name} is not in its marks list (${(row.marks || []).join(', ') || 'none'}); applied anyway`);
    const was = row.markAt && row.markAt[m.name];
    row.markAt = { ...(row.markAt || {}), [m.name]: { beat: m.beat, atMs: m.atMs, rawMs: m.rawMs, markSource: m.markSource } };
    lines[i] = `  ${JSON.stringify(row)}${comma ? ',' : ''}`;
    changes.push(`corpus ${m.id}.markAt.${m.name}: ${was ? `${was.atMs} ms (beat ${was.beat}) → ` : ''}${m.atMs} ms (beat ${m.beat}, raw ${m.rawMs}, ${m.markSource})`);
  }
  const out = lines.join('\n');
  JSON.parse(out);   // never write a file that doesn't parse
  return { text: out, changes, warnings };
}

/** qa/mixes.json text + marks → { text, changes, warnings }: bar1 → bar1At (s) on every side of that id that has one */
export function applyToMixes(text, marks) {
  let lines = String(text).split('\n');
  const changes = [], warnings = [];
  for (const m of marks.filter(x => x.name === BAR1)) {
    const s = Math.round(m.atMs / 1000 * 1e4) / 1e4;
    let hit = 0;
    lines = lines.map(l => {
      if (!l.includes(`"id": ${JSON.stringify(m.id)}`) || !/"bar1At":\s*(null|-?[\d.]+)/.test(l)) return l;
      hit++;
      const was = l.match(/"bar1At":\s*(null|-?[\d.]+)/)[1];
      changes.push(`mixes ${m.id} bar1At: ${was} → ${s} s (beat ${m.beat}, raw ${m.rawMs}, ${m.markSource})`);
      return l.replace(/"bar1At":\s*(null|-?[\d.]+)/, `"bar1At": ${s}`);
    });
    if (!hit) warnings.push(`${m.id}: no mix side with a bar1At; bar1 not applied`);
  }
  const out = lines.join('\n');
  JSON.parse(out);
  return { text: out, changes, warnings };
}

async function main(argv) {
  const args = argv.slice(2), has = k => args.includes(k), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const log = args.find(a => !a.startsWith('--') && a !== opt('--dir'));
  if (!log) { console.error('usage: node qa/marks-apply.mjs <session.jsonl> [--dir <tracks dir>] [--write]'); return 2; }
  const records = parseLog(fs.readFileSync(log, 'utf8'));
  let idOfStem = {}, gridOf = () => null;
  if (opt('--dir')) {
    const dir = path.resolve(opt('--dir'));
    try {
      const map = JSON.parse(fs.readFileSync(path.join(path.dirname(dir), 'corpus-map.json'), 'utf8')).tracks || {};
      idOfStem = Object.fromEntries(Object.entries(map).map(([id, stem]) => [stem, id]));
      gridOf = id => { try { return map[id] ? JSON.parse(fs.readFileSync(path.join(dir, `${map[id]}.beatgrid.json`), 'utf8')) : null; } catch { return null; } };
    } catch { console.log('marks-apply: no corpus-map.json beside the tracks folder; ids come from the log only'); }
  }
  const got = marksFromLog(records, { idOfStem });
  const marks = refit(got.marks, gridOf);
  const c = applyToCorpus(fs.readFileSync(CORPUS_FILE, 'utf8'), marks), x = applyToMixes(fs.readFileSync(MIXES_FILE, 'utf8'), marks);
  for (const l of [...got.problems, ...c.warnings, ...x.warnings]) console.log(`warning: ${l}`);
  for (const l of [...c.changes, ...x.changes, ...barOkLines(marks)]) console.log(l);
  if (!c.changes.length && !x.changes.length) { console.log('marks-apply: nothing to change'); return 0; }
  if (!has('--write')) { console.log('marks-apply: dry run; --write to apply'); return 0; }
  fs.writeFileSync(CORPUS_FILE, c.text);
  fs.writeFileSync(MIXES_FILE, x.text);
  console.log('marks-apply: written qa/corpus.json and qa/mixes.json; review with git diff and commit (nothing was committed)');
  return 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).then(code => process.exit(code), e => { console.error(`marks-apply: ${e.message}`); process.exit(1); });
}
