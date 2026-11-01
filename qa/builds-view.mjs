// The viewer's /builds page (#162): one row per build in qa/builds.json, newest first, with its thumbnail, results,
// links (check.md, stills, swipe, the live page), filters (scene, status, kind, "needs me") and the user's notes
// (qa/notes.mjs). Pure functions over plain data, so node --test can load them without the server
// (qa/runner/test/builds-view.test.mjs); qa/serve.mjs reads the files and serves the routes.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const REPO = 'borboss366/cellular-viz';
export const STATUSES = ['queued', 'running', 'failed', 'ready', 'discarded', 'contended', 'merged', 'closed'];
export const KINDS = ['page', 'experiment', 'audio'];
const PAGE_RE = /^\d\d[a-z]?-[a-z0-9-]+$/;
const BRANCH_RE = /^[\w.\/-]+$/;

/** what the build was: an experiment run (qa-ready, exp-run's folder …/runs/<stamp>-prN), of kind audio, or a page check */
export function buildKind(b, results = null) {
  if (results && (results.kind === 'audio' || (Array.isArray(results.runs) && results.runs.some(r => r && r.audio)))) return 'audio';   // older runs: no kind, but runs[].audio
  if (/\/runs\/[^/]+-pr\d+\//.test(b.report || '') || /^pr-\d+$/.test(b.page || '')) return 'experiment';
  return 'page';
}
/** report-only rows that would fail, from the build's check.md (`| name | ℹ️ | would fail · … |`) */
export const wouldFail = md => (typeof md === 'string' ? md.split('\n').filter(l => /^\| .+ \| ℹ️ \| would fail/.test(l)).length : 0);
/** the live page: GitHub Pages once merged, raw.githack on the PR's branch while it is open, else none */
export function liveLink(b) {
  if (!PAGE_RE.test(b.page || '')) return null;
  if (b.status === 'merged') return `https://borboss366.github.io/cellular-viz/experiments/${b.page}.html`;
  if (b.status === 'closed' || !b.branch || !BRANCH_RE.test(b.branch) || b.branch.includes('..')) return null;
  return `https://raw.githack.com/${REPO}/${b.branch.split('/').map(encodeURIComponent).join('/')}/experiments/${b.page}.html`;
}
/** "16 Hodge kaleidoscope" from 16-hodge-kaleidoscope */
export const sceneName = page => { const m = String(page || '').match(/^(\d\d[a-z]?)-(.+)$/); return m ? `${m[1]} ${m[2].replace(/-/g, ' ')}` : String(page || '?'); };
export const sceneOf = page => (String(page || '').match(/^(\d\d[a-z]?)-/) || [])[1] || null;
export const needsMe = r => r.status === 'ready' && r.waitingOn === 'user';
const when = b => b.finished || b.at || b.started || '';

/**
 * One row per build id (builds.json is append-only; loadBuilds keeps the latest line per id), newest first.
 * info(b) → {results, checkMd, thumb, stills} read from the build's folder by the server (all optional).
 */
export function buildRows(builds, info = () => ({})) {
  const seen = new Map();
  for (const b of builds) if (b && b.id) seen.set(b.id, b);
  return [...seen.values()].map(b => {
    const i = info(b) || {};
    return { ...b, type: buildKind(b, i.results), wouldFail: wouldFail(i.checkMd), thumb: !!i.thumb, stills: i.stills || null,
      live: liveLink(b), scene: sceneOf(b.page), when: when(b) };
  }).sort((a, b) => b.when.localeCompare(a.when) || b.id.localeCompare(a.id));
}

/** the filters from the query string, kept only when they name a known value */
export function parseFilters(q) {
  const get = k => (q && typeof q.get === 'function' ? q.get(k) : q && q[k]) || '';
  const scene = get('scene'), status = get('status'), kind = get('kind'), me = get('me');
  return { scene: /^\d\d[a-z]?$/.test(scene) ? scene : '', status: STATUSES.includes(status) ? status : '', kind: KINDS.includes(kind) ? kind : '',
    me: me === '1' || me === 'on' };
}
export const filterRows = (rows, f = {}) => rows.filter(r => (!f.scene || r.scene === f.scene) && (!f.status || r.status === f.status)
  && (!f.kind || r.type === f.kind) && (!f.me || needsMe(r)));

// ---------- HTML ----------
const CHIP = { queued: '#5b6478', running: '#2b5cff', failed: '#d6455d', ready: '#2bd96b', discarded: '#b07a1e', contended: '#b07a1e', merged: '#3a4560', closed: '#3a4560' };
const chip = st => `<span class="chip" style="background:${CHIP[st] || '#5b6478'}">${esc(st === 'ready' ? 'ready to merge' : st)}</span>`;
const WAIT = { dev: 'VIZ dev', 'qa-box': 'QA box', user: 'you' };
const ago = (iso, now) => { if (!iso) return ''; const m = Math.round((now - Date.parse(iso)) / 60000); return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const gatesOf = b => (b.gates || []).length ? `${b.gates.filter(g => g.ok).length}/${b.gates.length}` : '–';

function noteHtml(id, e) {
  const state = e.posted ? (e.posted.url ? `<a href="${esc(e.posted.url)}">shared ↗</a>` : 'shared')
    : e.share ? 'sharing…' : `private · <button class="sm" data-share="${e.n}">Share to PR</button>`;
  return `<div class="note"><span class="m">${esc(String(e.at).slice(0, 16).replace('T', ' '))} UTC · ${state}</span><div class="nt">${esc(e.text)}</div></div>`;
}
function rowHtml(r, notes, now) {
  const enc = encodeURIComponent;
  const links = [];
  if (r.report) links.push(`<a href="/report/${r.report.split('/').map(enc).join('/')}">check.md</a>`);
  if (r.stills) links.push(`<a href="${esc(r.stills)}">stills</a>`);
  if (r.swipe) links.push(`<a href="${esc(r.swipe)}">swipe</a>`);
  if (r.live) links.push(`<a href="${esc(r.live)}" target="_blank">live page ↗</a>`);
  const pr = r.pr ? `<a href="https://github.com/${REPO}/pull/${enc(r.pr)}">#${esc(r.pr)}</a>` : '';
  const hist = r.pr ? `<a href="/builds/${enc(r.kind || 'viz')}/${enc(r.pr)}#round-${enc(r.round)}">${esc(r.id)}</a>` : esc(r.id);
  const thumb = r.thumb ? `<a href="${esc(r.stills || '/thumb/' + enc(r.id))}"><img class="t" src="/thumb/${enc(r.id)}" loading="lazy" alt=""></a>` : '<div class="t none"></div>';
  const list = (notes || []).slice().reverse();
  return `<div class="card b${needsMe(r) ? ' me' : ''}" id="b-${esc(r.id)}" data-id="${esc(r.id)}"><div class="bh">${thumb}<div class="bi">
    <b>${esc(sceneName(r.page))}</b> <span class="m">${pr} · ${hist} · ${esc(r.commit || '')}</span>
    <div class="row">${chip(r.status)} <span class="m">${esc(r.type)} · gates ${gatesOf(r)}${r.wouldFail ? ` · ℹ️ ${r.wouldFail} would fail` : ''}${r.waitingOn ? ` · waiting on ${esc(WAIT[r.waitingOn] || r.waitingOn)}` : ''} · ${esc(ago(r.when, now))}</span></div>
    <div class="row">${links.join(' · ')}</div></div></div>
    <div class="notes">${list.map(e => noteHtml(r.id, e)).join('')}</div>
    <div class="row"><textarea rows="1" placeholder="note (private; Share to PR posts it)"></textarea><button class="sm" data-save="0">Save</button><button class="sm" data-save="1">Save + share</button></div></div>`;
}
const select = (name, label, values, cur) => `<select name="${name}"><option value="">${label}: all</option>${values.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;

/** the body of /builds: filters, then the rows. notesOf(id) → that build's notes (qa/notes.mjs loadNotes) */
export function buildsBody(rows, f, notesOf = () => [], now = Date.now()) {
  const shown = filterRows(rows, f), scenes = [...new Set(rows.map(r => r.scene).filter(Boolean))].sort();
  const form = `<form class="row filters" method="get" action="/builds">${select('scene', 'scene', scenes, f.scene)}${select('status', 'status', STATUSES, f.status)}${select('kind', 'kind', KINDS, f.kind)}
    <label class="m"><input type="checkbox" name="me" value="1"${f.me ? ' checked' : ''}> needs me (${rows.filter(needsMe).length})</label></form>`;
  const js = `<script>
document.querySelectorAll('.filters select, .filters input').forEach(x => x.onchange = () => x.form.submit());
const post = (u, o) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o || {}) }).then(r => r.ok ? r : Promise.reject(r));
document.querySelectorAll('.b').forEach(card => {
  const id = card.dataset.id, ta = card.querySelector('textarea');
  card.querySelectorAll('[data-save]').forEach(b => b.onclick = () => { if (!ta.value.trim()) return;
    post('/notes/' + encodeURIComponent(id), { text: ta.value, share: b.dataset.save === '1' }).then(() => location.reload()).catch(() => alert('not saved')); });
  card.querySelectorAll('[data-share]').forEach(b => b.onclick = () => { if (!confirm('Post this note as a comment on the PR?')) return;
    post('/notes/' + encodeURIComponent(id) + '/' + b.dataset.share + '/share').then(() => location.reload()).catch(() => alert('not shared')); });
});</script>`;
  return `<p class="m">Every build, newest first: ${shown.length} of ${rows.length} shown. Notes stay on the box unless you press Share to PR.</p>${form}
    ${shown.length ? shown.map(r => rowHtml(r, notesOf(r.id), now)).join('') : '<div class="card">No builds match.</div>'}${js}`;
}
export const buildsCss = `.chip{color:#fff;border-radius:8px;padding:2px 8px;font-size:12px;white-space:nowrap}.bh{display:flex;gap:10px}
.t{width:96px;height:54px;object-fit:cover;flex:none;border-radius:6px;background:#05070c}.t.none{border:1px dashed #2c3850}.bi{flex:1;min-width:0}
.b.me{border-color:#2bd96b}.note{border-left:2px solid #2c3850;padding:2px 8px;margin:6px 0}.nt{white-space:pre-wrap}
textarea{font:inherit;flex:1;min-width:150px;background:#1a2234;color:#e6ecf7;border:1px solid #2c3850;border-radius:10px;padding:8px}
button.sm{padding:6px 10px;font-size:13px}select{font:inherit;background:#1a2234;color:#e6ecf7;border:1px solid #2c3850;border-radius:10px;padding:7px}`;
