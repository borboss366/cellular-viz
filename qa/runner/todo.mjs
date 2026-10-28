// The user's grading page lists qa/todo.json ({id, title, note?, links:[{label, href}], done?}). A build that ends
// "ready" with a swipe run is waiting on the user, so the runner adds its entry itself (QA box, 28 Oct: #84 16b passed
// 10/10 and recorded its swipe, but nobody added the entry, so the user never saw it). Older open entries the runner
// made for the same PR are closed as superseded. Entries added by hand are never touched.
import fs from 'node:fs';
import path from 'node:path';

export const todoFile = qaHome => path.join(qaHome, 'qa', 'todo.json');
const short = c => String(c || '').slice(0, 7);
export const todoId = b => `${b.page}-pr${b.pr}-${short(b.commit)}`;

/** /run/<exp>/<stamp>/compare → {run: '/run/<exp>/<stamp>', dir: 'qa/<exp>/runs/<stamp>'} or null */
export function swipeRun(url) {
  const m = String(url || '').match(/^\/run\/([\w.-]+)\/([\w.-]+)(?:\/compare)?\/?$/);
  return m && !m[1].includes('..') && !m[2].includes('..') ? { run: `/run/${m[1]}/${m[2]}`, dir: path.join('qa', m[1], 'runs', m[2]) } : null;
}
/** how many clips the swipe run recorded (results.json → results[]); 0 when it can't be read */
export function clipCount(qaHome, dir) {
  try { const r = JSON.parse(fs.readFileSync(path.join(qaHome, dir, 'results.json'), 'utf8')); return Array.isArray(r.results) ? r.results.length : 0; } catch { return 0; }
}

/** the entry for a ready build with a swipe, or null */
export function entryFor(b, { title = '', clips = 0, at = new Date() } = {}) {
  if (!b || b.status !== 'ready' || !b.swipe) return null;
  const s = swipeRun(b.swipe);
  if (!s) return null;
  const gates = b.gates || [], ok = gates.filter(g => g.ok).length;
  const links = [];
  if (clips >= 2) links.push({ label: '⇄ compare', href: `${s.run}/compare` });
  links.push({ label: '▶ watch', href: s.run });
  return {
    id: todoId(b), from: 'QA runner', pr: b.pr, build: b.id,
    title: `${b.page} (PR #${b.pr})${title ? `: ${title}` : ''}`,
    note: `${b.id} @${short(b.commit)}: gates ${ok}/${gates.length} passed${b.note ? ` (${b.note})` : ''}. ` +
      (clips >= 2 ? `${clips} clips: pick the ones you like in ⇄ compare.` : 'One clip: watch it, then tell VIZ dev in the group.'),
    links, at: at.toISOString(),
  };
}

/** add the build's entry to qa/todo.json and close the runner's older open entries for its PR.
 *  → { changed, id?, superseded: [ids] }  (nothing written when the entry is already there or the build doesn't qualify) */
export function addTodo({ qaHome, b, title = '', at = new Date() }) {
  const s = b && swipeRun(b.swipe);
  const e = entryFor(b, { title, clips: s ? clipCount(qaHome, s.dir) : 0, at });
  if (!e) return { changed: false, superseded: [] };
  const file = todoFile(qaHome);
  let list = [];
  try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (!Array.isArray(list)) list = [];
  if (list.some(t => t.id === e.id)) return { changed: false, id: e.id, superseded: [] };
  const superseded = [];
  for (const t of list) {
    if (t.done || t.from !== 'QA runner' || t.pr !== b.pr) continue;   // hand-made entries have no pr field: never touched
    t.done = at.toISOString(); t.superseded = e.id; superseded.push(t.id);
  }
  list.push(e);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 1) + '\n');
  fs.renameSync(tmp, file);
  return { changed: true, id: e.id, superseded };
}
