// The shared gates every page build gets on top of its own check (#88): QA box's qa/check-shared.mjs, flash
// (WCAG 2.3.1 general + red) and GPU time, from CHECKS_REF like every check script. Its check.md rows are appended
// to the build's check.md under their own heading, so qa/builds.mjs gates on the ✅/❌ rows; ⚠️ (not measured) and
// ℹ️ rows are report only. SHARED_CHECKS=0 turns it off; SHARED_TIMEOUT_MIN (default 12) bounds one run.
import fs from 'node:fs';
import path from 'node:path';

export const SCRIPT = 'check-shared.mjs';
export const HEADING = '## shared gates (qa/check-shared.mjs)';

/** check-shared's check.md → the block appended to the build's check.md (its own # title dropped) */
export function section(md) {
  const body = String(md).replace(/\r/g, '').split('\n').filter((l, i) => !(i < 3 && /^# /.test(l))).join('\n').trim();
  return `\n\n${HEADING}\n\n${body}\n`;
}

const row = (gate, mark, detail) => `| ${gate} | ${mark} | ${String(detail).replace(/[|\n\r]/g, ' ').slice(0, 280)} |`;
const table = rows => `| gate | result | detail |\n|---|---|---|\n${rows.join('\n')}`;

/**
 * Run the shared check for one page build and append its rows to <dest>/check.md.
 *   run: the runner's run(cmd, args, {cwd, timeoutMs}) → {code, out, err}
 *   tree: the unpacked build tree (qa/ from CHECKS_REF, experiments/ from the PR); page: '13-flow-lab'
 *   dest: the build's report folder (has check.md); query: extra page query (host pages: 'w=2560&h=1440&dpr=1')
 * → { ran, ok, why }  (ok: the shared check wrote its check.md; the gates themselves are in the rows)
 */
export async function runShared({ run, tree, page, dest, timeoutMs = 12 * 60e3, query = '', log = () => {} }) {
  const script = path.join(tree, 'qa', SCRIPT), checkMd = path.join(dest, 'check.md');
  const append = s => fs.appendFileSync(checkMd, s);
  if (!fs.existsSync(script)) {
    append(section(table([row('shared gates', 'ℹ️', `qa/${SCRIPT} is not on the checks ref yet: not run`)])));
    return { ran: false, ok: false, why: 'no script' };
  }
  const out = path.join(dest, 'shared');
  fs.mkdirSync(out, { recursive: true });
  const args = [script, '--experiments', path.join(tree, 'experiments'), '--page', `${page}.html`, '--out', out];
  if (query) args.push('--query', query);
  log(`shared gates for ${page}: node qa/${SCRIPT} --page ${page}.html${query ? ` --query ${query}` : ''}`);
  const r = await run('node', args, { cwd: tree, timeoutMs });
  const md = path.join(out, 'check.md');
  if (!fs.existsSync(md)) {
    append(section(table([row('the shared check ran to the end and wrote check.md', '❌',
      `exit ${r.code}: ${(r.err || r.out || '').trim().split('\n').slice(-3).join(' / ')}`)])));
    try { fs.writeFileSync(path.join(out, 'runner.log'), `exit ${r.code}\n\n${String(r.err || '').slice(-20000)}`); } catch {}
    return { ran: true, ok: false, why: `exit ${r.code}` };
  }
  append(section(fs.readFileSync(md, 'utf8')));
  return { ran: true, ok: true, why: null };
}
