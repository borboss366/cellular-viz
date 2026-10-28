#!/usr/bin/env node
// Board moves for the cellular-viz kanban (GitHub Project v2 #1 of borboss366), worked out from the builds log.
// It replaces qa/board.py's per-PR `set` calls: the runner runs it after every build and merge, and QA box can run
// the same thing with the fixed command `sh <RUNNER_HOME>/qa/board-sync.sh`. It uses the box's gh login (project scope).
//
//   node qa/runner/board.mjs sync [--dry]
//
// Rules (QA box's, from board.py):
//   latest build of an open PR: queued / running → QA · failed → In progress · ready → Your review · merged → Done
//   closed or merged PRs and issues → Done · open ones not on the board → Ideas
// A build moves its card once: RUNNER_STATE/board.json remembers which build each card was last moved for, so a card
// the user moves by hand stays where they put it until the next build of that PR.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const OWNER = 'borboss366', REPO = 'cellular-viz', NUMBER = 1;
// passed = every gate passed, waiting on QA box's swipe run (builds.mjs keeps status "running" with a finish time)
export const TARGET = { queued: 'QA', running: 'QA', failed: 'In progress', passed: 'Your review', ready: 'Your review', merged: 'Done', closed: 'Done' };
const RANK = { failed: 0, queued: 1, running: 1, passed: 2, ready: 2, merged: 3, closed: 3 };

/** the status a build stands for on the board, or null when it says nothing about the PR:
 *  a failure that is only "no check script for this page" (QA box's gap, not dev's), or a queued/running build that
 *  never finished and is older than the runner's timeout (left over from a stopped runner) */
export function boardStatus(b, { now = Date.now(), staleMin = 90 } = {}) {
  if (b.status === 'failed') {
    const bad = (b.gates || []).filter(g => !g.ok);
    if (b.note === 'no check script yet' || (bad.length && bad.every(g => /^a check script for /.test(g.name)))) return null;
    return 'failed';
  }
  if (b.status === 'queued' || b.status === 'running') {
    if (b.finished) return b.status === 'running' ? 'passed' : null;
    const t = Date.parse(b.started || b.at || '');
    return Number.isFinite(t) && now - t > staleMin * 60e3 ? null : b.status;
  }
  return TARGET[b.status] ? b.status : null;
}

/** the newest build of each page of each PR, folded into one status per PR (the worst page wins) */
export function prStatus(builds, opts = {}) {
  const latest = new Map();
  for (const b of builds) {
    if (!b || !b.pr || !b.status || !boardStatus(b, opts)) continue;
    const k = `${b.pr}:${b.page}`, o = latest.get(k);
    if (!o || (b.round || 0) > (o.round || 0) || ((b.round || 0) === (o.round || 0) && String(b.at || '') >= String(o.at || ''))) latest.set(k, b);
  }
  const out = {};
  for (const b of latest.values()) {
    const o = out[b.pr];
    const s = boardStatus(b, opts);
    if (!o || (RANK[s] ?? 9) < (RANK[o.status] ?? 9)) out[b.pr] = { status: s, id: b.id, key: `${b.id}:${s}` };
  }
  return out;
}

/** moves: [{n, from, to, why, key}] from the board items {n: {status}}, the repo's items {n: state} and the builds */
/** seed: the first sync (no board.json yet) only records the current builds as applied and moves no card for them,
 *  so old builds never replay over cards placed by hand; closed → Done and missing → Ideas still happen */
export function plan(items, states, builds, applied = {}, { seed = false, ...opts } = {}) {
  const moves = [], by = prStatus(builds, opts);
  for (const [k, st] of Object.entries(states)) {
    const n = +k, cur = items[n] ? items[n].status : undefined;
    if (st === 'CLOSED' || st === 'MERGED') {
      if (items[n] && cur !== 'Done') moves.push({ n, from: cur, to: 'Done', why: st.toLowerCase() });
      continue;
    }
    const b = by[n];
    if (b && TARGET[b.status] && applied[n] !== b.key) {
      if (seed) { moves.push({ n, from: cur, to: cur, why: 'first sync: recorded, not moved', key: b.key, noop: true }); if (!items[n]) moves.push({ n, from: undefined, to: 'Ideas', why: 'open, not on the board' }); }
      else if (cur !== TARGET[b.status]) moves.push({ n, from: cur, to: TARGET[b.status], why: `build ${b.id} ${b.status}`, key: b.key });
      else moves.push({ n, from: cur, to: cur, why: 'already there', key: b.key, noop: true });
    } else if (!items[n]) moves.push({ n, from: undefined, to: 'Ideas', why: 'open, not on the board' });
  }
  return moves;
}

// ---------- GitHub (gh, the box's login) ----------
function gh(args) {
  return new Promise((resolve, reject) => execFile('gh', args, { maxBuffer: 32 << 20 }, (e, out, err) => (e ? reject(new Error((err || e.message).trim().split('\n').slice(-2).join(' / '))) : resolve(out))));
}
async function gql(query, vars = {}) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [k, v] of Object.entries(vars)) args.push(typeof v === 'number' ? '-F' : '-f', `${k}=${v}`);
  const j = JSON.parse(await gh(args));
  if (j.errors) throw new Error(j.errors.map(e => e.message).join('; '));
  return j.data;
}
async function board() {
  const d = (await gql(`query($o:String!,$n:Int!){ user(login:$o){ projectV2(number:$n){ id
    field(name:"Status"){ ... on ProjectV2SingleSelectField { id options { id name } } }
    items(first:100){ nodes{ id fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name } }
      content{ ... on Issue{ number } ... on PullRequest{ number } } } } } } }`, { o: OWNER, n: NUMBER })).user.projectV2;
  const items = {};
  for (const it of d.items.nodes) { const c = it.content || {}; if (c.number) items[c.number] = { item: it.id, status: it.fieldValueByName ? it.fieldValueByName.name : undefined }; }
  return { pid: d.id, fid: d.field.id, opts: Object.fromEntries(d.field.options.map(o => [o.name, o.id])), items };
}
async function repoStates() {
  const d = (await gql(`query($o:String!,$r:String!){ repository(owner:$o,name:$r){
    issues(first:100, orderBy:{field:CREATED_AT, direction:DESC}){ nodes{ number state } }
    pullRequests(first:100, orderBy:{field:CREATED_AT, direction:DESC}){ nodes{ number state } } } }`, { o: OWNER, r: REPO })).repository;
  const out = {};
  for (const x of [...d.issues.nodes, ...d.pullRequests.nodes]) out[x.number] = x.state;
  return out;
}
async function setStatus(b, n, status) {
  let it = b.items[n] && b.items[n].item;
  if (!it) {
    const node = (await gql(`query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){ issueOrPullRequest(number:$n){ ... on Issue{id} ... on PullRequest{id} } } }`, { o: OWNER, r: REPO, n })).repository.issueOrPullRequest;
    it = (await gql('mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }', { p: b.pid, c: node.id })).addProjectV2ItemById.item.id;
  }
  if (!b.opts[status]) throw new Error(`no "${status}" column on the board`);
  await gql('mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }', { p: b.pid, i: it, f: b.fid, o: b.opts[status] });
}

/** one sync: read the board, the repo and the builds log, make the moves. → [{n, from, to, why, ok, error?}] */
export async function sync({ buildsFile, stateDir, dry = false, log = console.log } = {}) {
  const builds = (() => { try { return fs.readFileSync(buildsFile, 'utf8').split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } })();
  const appliedFile = path.join(stateDir, 'board.json');
  let applied = {};
  const seed = !fs.existsSync(appliedFile);
  try { applied = JSON.parse(fs.readFileSync(appliedFile, 'utf8')); } catch {}
  const b = await board(), states = await repoStates();
  const done = [];
  if (seed) log('first sync: recording the current builds, no card moves for them');
  for (const m of plan(b.items, states, builds, applied, { seed, staleMin: +process.env.RUNNER_TIMEOUT_MIN || 90 })) {
    if (m.noop) { if (!dry) applied[m.n] = m.key; continue; }
    if (dry) { done.push({ ...m, ok: true, dry: true }); log(`would move #${m.n} ${m.from || '(not on board)'} → ${m.to} (${m.why})`); continue; }
    try { await setStatus(b, m.n, m.to); if (m.key) applied[m.n] = m.key; done.push({ ...m, ok: true }); log(`#${m.n} ${m.from || '(not on board)'} → ${m.to} (${m.why})`); }
    catch (e) { done.push({ ...m, ok: false, error: e.message }); log(`#${m.n} → ${m.to} failed: ${e.message}`); }
  }
  if (!dry) { fs.mkdirSync(stateDir, { recursive: true }); fs.writeFileSync(appliedFile, JSON.stringify(applied, null, 1)); }
  return done;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const qaHome = path.resolve(process.env.QA_HOME || path.join(here, '..', '..'));
  const stateDir = path.resolve(process.env.RUNNER_STATE || path.join(os.homedir(), '.cache', 'cellular-viz-runner'));
  if (process.argv[2] !== 'sync') { console.error('usage: node qa/runner/board.mjs sync [--dry]'); process.exit(2); }
  const r = await sync({ buildsFile: path.join(qaHome, 'qa', 'builds.json'), stateDir, dry: process.argv.includes('--dry') });
  console.log(`${r.filter(m => m.ok).length} moves${r.some(m => !m.ok) ? `, ${r.filter(m => !m.ok).length} failed` : ''}`);
  process.exit(r.some(m => !m.ok) ? 1 : 0);
}
