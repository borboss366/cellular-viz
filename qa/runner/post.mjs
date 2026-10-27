#!/usr/bin/env node
// What the runner does after each build, so QA box doesn't type it: a dated qa/history/ entry (.md + the same-name .sh
// of the commands as they ran) and a local commit of only the .md/.json reports, with a message made from the results.
// The push stays QA box's own fixed command. QA box can commit leftovers the same way with qa/commit-reports.sh:
//
//   node qa/runner/post.mjs commit-reports       (QA_HOME from the environment)
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPORT_RE = /\.(md|json)$/;
const q = s => (/^[\w@%+=:,./-]+$/.test(String(s)) ? String(s) : `'${String(s).replace(/'/g, `'\\''`)}'`);
export const shLine = (cmd, args) => [cmd, ...args].map(q).join(' ');
export const stamp = (d = new Date()) => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

/** folders of one build, relative to QA_HOME: its report folder and its swipe run */
export function buildDirs(b) {
  const out = [];
  if (b && b.report) out.push(path.dirname(b.report));
  const m = b && typeof b.swipe === 'string' && b.swipe.match(/^\/run\/([\w.-]+)\/([\w.-]+)\/compare$/);
  if (m) out.push(path.join('qa', m[1], 'runs', m[2]));
  return out;
}

/** commit message for a build: one subject line with the verdict, the failed gates, where to look */
export function messageFor(b, extra = '') {
  const gates = b.gates || [], ok = gates.filter(g => g.ok).length;
  const failed = gates.filter(g => !g.ok).map(g => g.name).slice(0, 8);
  return `qa: #${b.pr} ${b.page} @${b.commit} ${b.status} ${ok}/${gates.length} (${b.id})\n\n`
    + (failed.length ? `Failed: ${failed.join('; ')}${gates.length - ok > failed.length ? '; …' : ''}\n` : 'Every gate passed.\n')
    + (b.report ? `Report: ${b.report}\n` : '') + (b.swipe ? `Swipe: ${b.swipe}\n` : '') + (b.note ? `Note: ${b.note}\n` : '') + extra
    + '\nMade-by: QA runner\n';
}

/** qa/history/<stamp>-runner-pr<N>-<page>.md + .sh → their paths relative to QA_HOME */
export function historyEntry({ qaHome, b, trace = [], result = '', gate = null, checksRef = '', at = new Date() }) {
  const name = `${stamp(at)}-runner-pr${b.pr}-${b.page}`.replace(/[^\w.-]+/g, '-'), dir = path.join(qaHome, 'qa', 'history');
  fs.mkdirSync(dir, { recursive: true });
  const md = `# ${name}\n\nRunner build \`${b.id}\`: #${b.pr} ${b.page} @${b.commit}, checks from \`${checksRef}\`.\n\n`
    + `- result: ${result || b.status}\n- gates: ${(b.gates || []).filter(g => g.ok).length}/${(b.gates || []).length}\n`
    + (b.report ? `- report: \`${b.report}\`\n` : '') + (b.swipe ? `- swipe: ${b.swipe}\n` : '')
    + (gate ? `- GPU before the run: ${(gate.readings || []).slice(-(gate.idleSecs || 5)).join(', ') || 'no reading'} % (waited ${gate.waitedS} s)\n` : '')
    + `\n\`${name}.sh\` holds the commands as the runner ran them (its temp folders are gone; to run it again, push a commit\nor relabel the PR qa-ready).\n`;
  const sh = `#!/bin/sh\n# ${name}: runner build ${b.id}, #${b.pr} ${b.page} @${b.commit}, checks from ${checksRef}; result: ${String(result || b.status).replace(/\n/g, ' ')}\n`
    + `# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).\n`
    + trace.map(([cmd, args]) => shLine(cmd, args)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, name + '.md'), md);
  fs.writeFileSync(path.join(dir, name + '.sh'), sh);
  return [path.join('qa', 'history', name + '.md'), path.join('qa', 'history', name + '.sh')];
}

/** the .md/.json files under these folders (relative to QA_HOME) */
export function reportFiles(qaHome, dirs) {
  const out = [];
  const walk = rel => {
    const abs = path.join(qaHome, rel);
    let ents = [];
    try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) { if (e.name !== 'videos' && e.name !== 'node_modules') walk(r); } else if (REPORT_RE.test(e.name)) out.push(r);
    }
  };
  for (const d of dirs) if (d && !d.includes('..')) walk(d);
  return out;
}

const git = (qaHome, args) => new Promise(resolve => execFile('git', ['-C', qaHome, ...args], { maxBuffer: 32 << 20 }, (e, out, err) => resolve({ code: e ? (e.code ?? 1) : 0, out, err })));
/** add + commit exactly these paths (other staged work stays staged). → {ok, sha?, why?} */
export async function commitPaths(qaHome, paths, message) {
  paths = [...new Set(paths)].filter(p => fs.existsSync(path.join(qaHome, p)));
  if (!paths.length) return { ok: false, why: 'nothing to commit' };
  const add = await git(qaHome, ['add', '--', ...paths]);
  if (add.code) return { ok: false, why: `git add: ${add.err.trim().split('\n').pop()}` };
  const diff = await git(qaHome, ['diff', '--cached', '--quiet', '--', ...paths]);
  if (diff.code === 0) return { ok: false, why: 'nothing changed' };
  const c = await git(qaHome, ['commit', '-q', '-m', message, '--', ...paths]);
  if (c.code) return { ok: false, why: `git commit: ${(c.err || c.out).trim().split('\n').pop()}` };
  const h = await git(qaHome, ['rev-parse', '--short', 'HEAD']);
  return { ok: true, sha: h.out.trim() };
}

/** qa/commit-reports.sh: commit every changed or new .md/.json under qa/ (and qa/history/*.sh) with a message from the builds log */
export async function commitReports(qaHome) {
  const st = await git(qaHome, ['status', '--porcelain=v1', '-uall', '--', 'qa']);
  if (st.code) return { ok: false, why: st.err.trim() };
  const paths = st.out.split('\n').filter(Boolean).map(l => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop())
    .filter(p => !p.includes('node_modules/') && !p.includes('/videos/') && (REPORT_RE.test(p) || /^qa\/history\/[^/]+\.sh$/.test(p)));
  if (!paths.length) return { ok: false, why: 'no changed reports' };
  let builds = [];
  try { const m = new Map(); for (const l of fs.readFileSync(path.join(qaHome, 'qa', 'builds.json'), 'utf8').split('\n')) { try { const b = JSON.parse(l); m.set(b.id, b); } catch {} } builds = [...m.values()]; } catch {}
  const touched = builds.filter(b => buildDirs(b).some(d => paths.some(p => p.startsWith(d + '/'))));
  const subject = touched.length
    ? `qa: reports for ${touched.map(b => `#${b.pr} ${b.page} ${b.status} ${(b.gates || []).filter(g => g.ok).length}/${(b.gates || []).length}`).join(', ')}`.slice(0, 200)
    : `qa: ${paths.length} report file${paths.length > 1 ? 's' : ''}`;
  const body = touched.map(b => `- ${b.id}: #${b.pr} ${b.page} @${b.commit} ${b.status}${b.report ? ` · ${b.report}` : ''}`).join('\n');
  const r = await commitPaths(qaHome, paths, `${subject}\n\n${body ? body + '\n\n' : ''}${paths.length} files (.md/.json only).\n\nMade-by: QA runner\n`);
  return { ...r, files: paths.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const qaHome = path.resolve(process.env.QA_HOME || path.join(here, '..', '..'));
  if (process.argv[2] !== 'commit-reports') { console.error('usage: node qa/runner/post.mjs commit-reports'); process.exit(2); }
  const r = await commitReports(qaHome);
  console.log(r.ok ? `committed ${r.files} report files as ${r.sha} in ${qaHome}; push with the usual command` : `no commit: ${r.why}`);
}
