// The viewer's page for a runner experiment run (qa/<page>/runs/<stamp>-prN, written by qa/runner/exp-run.mjs).
// Those folders hold exp-run's results.json ({id, page, pr, sha, runs, checks, swipe, gates, notes}), not the
// {meta, results} of a qa/run.mjs sweep, and no videos: only stills/, the check folders and check.md. qa/serve.mjs
// used to read them as a sweep and answered 500 (#155, 1 Nov). Pure functions, so node --test can load them without
// the viewer's server (qa/runner/test/exp-view.test.mjs).

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// one path part the viewer will serve: letters, digits, _ . @ - (exp-run's still names carry '@', e.g. default@1080p-1.png),
// never "." or ".." alone
export const safePart = s => typeof s === 'string' && /^[\w.@-]+$/.test(s) && !/^\.+$/.test(s);

/** results.json of an exp-run folder (rather than a qa/run.mjs sweep with results[]). */
export const isExpRun = d => !!d && !Array.isArray(d.results) && Array.isArray(d.runs);

const url = (...parts) => '/' + parts.map(p => encodeURIComponent(p)).join('/');
const fileUrl = (exp, stamp, rel) => url('file', exp, stamp, ...rel.split('/'));
const reportUrl = (exp, stamp, rel) => url('report', 'qa', exp, 'runs', stamp, ...rel.split('/'));
const relOk = rel => typeof rel === 'string' && rel.split('/').every(safePart);
const mark = g => (g.skipped ? 'ℹ️' : g.ok ? '✅' : '❌');
const fmt = v => (typeof v === 'number' ? String(+v.toPrecision(4)) : String(v));

/**
 * The body of /run/<exp>/<stamp> for an exp-run folder: the gates (failing first), a link to check.md, report.md and
 * each check's own check.md, the swipe run when there is one, and each measured run with its stills and numbers.
 * has(rel): whether that file exists in the run folder (links only to files that are there). sharedDirs: the run
 * folder's shared/ and shared-<variant>/ folders (the shared gates, runner shared.mjs).
 */
export function expRunBody(exp, stamp, d, has = () => true, { sharedDirs = ['shared'] } = {}) {
  const gates = Array.isArray(d.gates) ? d.gates : [];
  const gated = gates.filter(g => !g.skipped), pass = gated.filter(g => g.ok).length;
  const links = [];
  if (has('check.md')) links.push(`<a href="${reportUrl(exp, stamp, 'check.md')}"><b>check.md</b></a>`);
  if (has('report.md')) links.push(`<a href="${fileUrl(exp, stamp, 'report.md')}">report.md</a>`);
  for (const c of d.checks || []) {
    const rel = c && c.dir ? `${c.dir}/check.md` : null;
    if (rel && relOk(rel) && has(rel)) links.push(`<a href="${reportUrl(exp, stamp, rel)}">${esc(c.script)}</a>`);
  }
  for (const sub of sharedDirs) {   // the shared gates' own folders: shared/, and shared-<variant>/ per shared.variants
    if (relOk(sub) && has(`${sub}/check.md`)) links.push(`<a href="${reportUrl(exp, stamp, `${sub}/check.md`)}">${esc(sub)}</a>`);
  }
  const sw = d.swipe && typeof d.swipe.url === 'string' && d.swipe.url.startsWith('/run/')
    ? `<div class="card">⇄ <a href="${esc(d.swipe.url)}"><b>Swipe run</b></a> <span class="m">old ${esc(d.swipe.old || 'none')} · new ${esc(String(d.swipe.new || '').slice(0, 7))}</span></div>`
    : `<p class="m">No swipe run in this folder (experiment runs record stills, no videos). A swipe recorded later is linked from <a href="/builds">Builds</a>.</p>`;
  const order = [...gates.filter(g => !g.skipped && !g.ok), ...gates.filter(g => !g.skipped && g.ok), ...gates.filter(g => g.skipped)];
  const gateList = order.map(g => `<div class="m">${mark(g)} ${esc(g.name)}${g.value !== undefined && g.value !== null && g.value !== '' ? ` · ${esc(String(g.value).slice(0, 200))}` : ''}</div>`).join('');
  const runCard = r => {
    const m = r.metrics || {};
    const nums = ['fps', 'frameMs.p95', 'frameMs.max', 'longFrames', 'gpuBusy', 'lum.mean', 'clip', 'errors']
      .filter(k => m[k] !== undefined && m[k] !== null).map(k => `${k} ${esc(fmt(m[k]))}`).join(' · ');
    const stills = (r.stills || []).filter(f => relOk(f) && has(f))
      .map(f => `<img src="${fileUrl(exp, stamp, f)}" alt="${esc(f)}" loading="lazy" style="margin-top:8px">`).join('');
    const size = r.size && r.size.w ? ` <span class="m">${r.size.w}×${r.size.h}</span>` : '';
    const vals = Object.entries(r.values || {}).map(([k, v]) => `${esc(k)} ${esc((JSON.stringify(v) ?? '—').slice(0, 80))}`).join(' · ');
    return `<div class="card"><b>${esc(r.label)}</b>${size}
      ${r.skipped ? `<div class="m">skipped: track missing (${esc(r.skipped)})</div>` : ''}
      ${nums ? `<div class="m">${nums}</div>` : ''}${vals ? `<div class="m">${vals}</div>` : ''}
      ${(r.errors || []).length ? `<div class="m">⚠ ${esc(r.errors.slice(0, 3).join(' / '))}</div>` : ''}
      ${stills}</div>`;
  };
  return `<p class="m">Experiment ${esc(d.id || exp)} for <a href="https://github.com/borboss366/cellular-viz/pull/${esc(d.pr)}">#${esc(d.pr)}</a>`
    + ` @${esc(String(d.sha || '').slice(0, 7))}${d.at ? ` · ${esc(String(d.at).slice(0, 16).replace('T', ' '))} UTC` : ''}`
    + `${d.hasGpu === false ? ' · ⚠ software GL, fps not comparable' : ''}</p>`
    + `<div class="card"><b>${pass}/${gated.length} gates pass</b>${gates.length > gated.length ? ` <span class="m">(${gates.length - gated.length} report-only)</span>` : ''}`
    + `<div class="row">${links.join(' · ')}</div><details${pass < gated.length ? ' open' : ''}><summary class="m">all rows</summary>${gateList}</details></div>`
    + sw + (d.runs || []).map(runCard).join('')
    + ((d.notes || []).length ? `<details><summary class="m">notes (${d.notes.length})</summary>${d.notes.map(n => `<div class="m">${esc(n)}</div>`).join('')}</details>` : '');
}

/** The viewer link of a build's run (b.report "qa/<exp>/runs/<stamp>/check.md"), or null. */
export function runLinkOf(report) {
  const m = typeof report === 'string' && report.match(/^qa\/([^/]+)\/runs\/([^/]+)\/check\.md$/);
  return m && safePart(m[1]) && safePart(m[2]) ? url('run', m[1], m[2]) : null;
}
