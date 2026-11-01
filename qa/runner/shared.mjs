// The shared gates every page build gets on top of its own check (#88): QA box's qa/check-shared.mjs, flash
// (WCAG 2.3.1 general + red) and GPU time, from CHECKS_REF like every check script. Its check.md rows are appended
// to the build's check.md under their own heading, so qa/builds.mjs gates on the ✅/❌ rows; ⚠️ (not measured) and
// ℹ️ rows are report only. SHARED_CHECKS=0 turns it off; SHARED_TIMEOUT_MIN (default 12) bounds one run.
import fs from 'node:fs';
import path from 'node:path';

export const SCRIPT = 'check-shared.mjs';
export const HEADING = '## shared gates (qa/check-shared.mjs)';

/**
 * check-shared's check.md → the block appended to the build's check.md (its own # title dropped). label: a variant pass
 * (experiment files' shared.variants): its heading names it and every row's gate gets a "[label] " prefix, so the
 * builds page tells the default URL's flash row from the variant's.
 */
export function section(md, label = null, query = '') {
  let lines = String(md).replace(/\r/g, '').split('\n').filter((l, i) => !(i < 3 && /^# /.test(l)));
  if (label) lines = lines.map(l => (/^\| /.test(l) && !/^\| gate \|/.test(l) && !/^\|-/.test(l) ? l.replace(/^\| /, `| [${label}] `) : l));
  const head = label ? `${HEADING} · variant ${label}${query ? ` (?${query})` : ''}` : HEADING;
  return `\n\n${head}\n\n${lines.join('\n').trim()}\n`;
}

const row = (gate, mark, detail) => `| ${gate} | ${mark} | ${String(detail).replace(/[|\n\r]/g, ' ').slice(0, 280)} |`;
const table = rows => `| gate | result | detail |\n|---|---|---|\n${rows.join('\n')}`;

/**
 * Run the shared check for one page build and append its rows to <dest>/check.md.
 *   run: the runner's run(cmd, args, {cwd, timeoutMs}) → {code, out, err}
 *   tree: the unpacked build tree (qa/ from CHECKS_REF, experiments/ from the PR); page: '13-flow-lab'
 *   dest: the build's report folder (has check.md); query: extra page query (host pages: 'w=2560&h=1440&dpr=1')
 *   label: a variant pass (null = the page's default URL): its own folder shared-<label>, its rows prefixed "[label] "
 * → { ran, ok, why }  (ok: the shared check wrote its check.md; the gates themselves are in the rows)
 */
export async function runShared({ run, tree, page, dest, timeoutMs = 12 * 60e3, query = '', label = null, log = () => {} }) {
  const script = path.join(tree, 'qa', SCRIPT), checkMd = path.join(dest, 'check.md');
  const append = s => fs.appendFileSync(checkMd, s);
  const sec = md => section(md, label, label ? query : '');
  if (!fs.existsSync(script)) {
    append(sec(table([row('shared gates', 'ℹ️', `qa/${SCRIPT} is not on the checks ref yet: not run`)])));
    return { ran: false, ok: false, why: 'no script' };
  }
  const out = path.join(dest, label ? `shared-${label}` : 'shared');
  fs.mkdirSync(out, { recursive: true });
  const args = [script, '--experiments', path.join(tree, 'experiments'), '--page', `${page}.html`, '--out', out];
  if (query) args.push('--query', query);
  log(`shared gates for ${page}${label ? ` (variant ${label})` : ''}: node qa/${SCRIPT} --page ${page}.html${query ? ` --query ${query}` : ''}`);
  const r = await run('node', args, { cwd: tree, timeoutMs });
  const md = path.join(out, 'check.md');
  if (!fs.existsSync(md)) {
    append(sec(table([row('the shared check ran to the end and wrote check.md', '❌',
      `exit ${r.code}: ${(r.err || r.out || '').trim().split('\n').slice(-3).join(' / ')}`)])));
    try { fs.writeFileSync(path.join(out, 'runner.log'), `exit ${r.code}\n\n${String(r.err || '').slice(-20000)}`); } catch {}
    return { ran: true, ok: false, why: `exit ${r.code}` };
  }
  append(sec(fs.readFileSync(md, 'utf8')));
  return { ran: true, ok: true, why: null };
}

/**
 * The shared passes of an experiment build: the page's default URL (unless shared.default is false), then one pass per
 * name in shared.variants, at that variant's URL (the file's params + the variant's params, as exp-run loads it).
 * → [{ label: null | name, query }]
 */
export function sharedPasses(exp, toQuery) {
  const s = (exp && exp.shared) || {}, out = [];
  if (s.default !== false) out.push({ label: null, query: '' });
  for (const name of s.variants || []) {
    const v = (exp.variants || []).find(x => x.name === name);
    if (v) out.push({ label: name, query: toQuery({ ...(exp.params || {}), ...(v.params || {}) }) });
  }
  return out;
}

/**
 * Experiment builds (qa/experiments/<PR>.json) get the shared gates too, for the page the experiment names (its id,
 * like '16-neon-lines'), when that page is in the PR's experiments/ folder and the run wrote a check.md.
 * → the page id, or null (no page, the 'pr-<n>' placeholder, or no check.md to append to)
 */
export function experimentPage({ page, tree, dest }) {
  if (typeof page !== 'string' || !/^\d\d-[a-z0-9-]+$/.test(page)) return null;
  if (!fs.existsSync(path.join(tree, 'experiments', `${page}.html`))) return null;
  if (!fs.existsSync(path.join(dest, 'check.md'))) return null;
  return page;
}
