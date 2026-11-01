// The user's notes on builds (#162): one file per build in QA_NOTES_DIR (on the box
// /home/puggie/pi-durable-worker/data/qa-notes), never in git.
//   <build-id>.json         written by the viewer only: [{n, at, text, share}] in the order written. An entry is never
//                           changed except for its share flag, and never deleted; an edit is a new entry.
//   <build-id>.shared.json  written by the runner only: {"<n>": {url, at}} for each note it posted to the build's PR
// Notes are private by default (the user's choice, #162 comment): only a note whose "Share to PR" button was pressed
// (share: true) is posted, once, as `Note from the user on <build-id>:` with a hidden marker. Before posting, the runner
// looks for that marker among the PR's comments, so a crash between posting and writing .shared.json can't post twice.
// One writer per file, each written atomically (a temp name, then rename), so viewer and runner never clash.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ID_RE = /^[a-z]+-\d+-\d+$/;   // a build id: viz-155-4
export const MAX_TEXT = 4000;

/** QA_NOTES_DIR, or qa-notes in the runner's state folder */
export const notesDir = (env = process.env) => env.QA_NOTES_DIR
  || path.join(env.RUNNER_STATE || path.join(os.homedir(), '.cache', 'cellular-viz-runner'), 'qa-notes');

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
function writeAtomic(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1) + '\n');
  fs.renameSync(tmp, f);
}
const fileOf = (dir, id) => { if (!ID_RE.test(id)) throw new Error(`bad build id ${id}`); return path.join(dir, `${id}.json`); };
const sharedFileOf = (dir, id) => { if (!ID_RE.test(id)) throw new Error(`bad build id ${id}`); return path.join(dir, `${id}.shared.json`); };

/** the build's notes as written, each with its post when the runner has shared it ({url, at}) */
export function loadNotes(dir, id) {
  const list = readJson(fileOf(dir, id), []), posted = readJson(sharedFileOf(dir, id), {});
  return (Array.isArray(list) ? list : []).map(e => ({ ...e, posted: posted[e.n] || null }));
}
/** every build id that has notes */
export function noteIds(dir) {
  try { return fs.readdirSync(dir).map(f => f.match(/^([a-z]+-\d+-\d+)\.json$/)).filter(Boolean).map(m => m[1]).sort(); } catch { return []; }
}

/** viewer: add a note (private unless share); returns the new entry */
export function addNote(dir, id, text, { share = false, now = new Date() } = {}) {
  const t = String(text ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_TEXT);
  if (!t) throw new Error('empty note');
  const f = fileOf(dir, id), list = readJson(f, []);
  const e = { n: list.reduce((m, x) => Math.max(m, x.n || 0), 0) + 1, at: now.toISOString(), text: t, share: !!share };
  list.push(e); writeAtomic(f, list);
  return e;
}
/** viewer: the "Share to PR" button; a shared note can't be made private again (it may already be posted) */
export function requestShare(dir, id, n) {
  const f = fileOf(dir, id), list = readJson(f, []), e = list.find(x => x.n === +n);
  if (!e) throw new Error(`no note ${n} on ${id}`);
  if (!e.share) { e.share = true; writeAtomic(f, list); }
  return e;
}

export const marker = (id, n) => `<!-- qa-note ${id} #${n} -->`;
/** the PR comment for a shared note: the text as the user wrote it (so knob: and button: lines still parse) */
export const commentBody = (id, e) => `Note from the user on ${id}:\n\n${e.text}\n\n${marker(id, e.n)}`;

/** runner: shared notes not posted yet, oldest first: [{id, n, at, text}] */
export function pendingShares(dir) {
  const out = [];
  for (const id of noteIds(dir)) for (const e of loadNotes(dir, id)) if (e.share && !e.posted) out.push({ id, n: e.n, at: e.at, text: e.text });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
/** runner: record a post */
export function markPosted(dir, id, n, url, now = new Date()) {
  const f = sharedFileOf(dir, id), m = readJson(f, {});
  m[n] = { url: url || null, at: now.toISOString() }; writeAtomic(f, m);
}

/**
 * runner: post every pending shared note once. prOf(id) → the build's PR number (or null: kept for later);
 * existing(pr, sinceIso) → the bodies and urls of the PR's comments since then [{body, url}]; post(pr, body) → the new
 * comment's url. Returns what it did: [{id, n, pr, url, how: 'posted' | 'found'}]. A failure stops the round (it is
 * tried again next poll) and is thrown after the notes before it are recorded.
 */
export async function shareNotes(dir, { prOf, existing, post, log = () => {} }) {
  const done = [];
  for (const p of pendingShares(dir)) {
    const pr = prOf(p.id);
    if (!pr) { log(`note ${p.id} #${p.n}: no PR for this build yet`); continue; }
    const mk = marker(p.id, p.n), seen = (await existing(pr, p.at)).find(c => typeof c.body === 'string' && c.body.includes(mk));
    if (seen) { markPosted(dir, p.id, p.n, seen.url); done.push({ ...p, pr, url: seen.url, how: 'found' }); continue; }
    const url = await post(pr, commentBody(p.id, p));
    markPosted(dir, p.id, p.n, url); done.push({ ...p, pr, url, how: 'posted' });
  }
  return done;
}
