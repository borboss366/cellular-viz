// QA viewer on the box: watch every run's videos and grade them from the phone.
//
//   node qa/serve.mjs [--port 8787]      → http://<box>:8787/
//
// Pages: /, /builds        every build (below); the viewer opens here (the user's choice, #162)
//        /grade            what waits for the user: the bots' asks, then runs to grade (was /)
//        /run/<exp>/<stamp> videos + scores + keep / maybe / dull; for a runner experiment folder (…-prN) its stills,
//                           gates and check links instead (exp-view.mjs)
//        /builds            every build (qa/builds.json via qa/builds.mjs), newest first: thumbnail, status, gates, links,
//                           the live page, filters (?scene=16&status=ready&kind=experiment&me=1) and the user's notes
//                           (qa/builds-view.mjs, qa/notes.mjs; #162). /builds/<kind>/<pr>: one PR's rounds.
//                           (/builds/155/4 and /builds/viz-155-4 go to that PR's page at that round)
//        /thumb/<build-id>  the build's first still; POST /notes/<build-id> {text, share}, /notes/<build-id>/<n>/share
// Verdicts are saved to qa/<exp>/runs/<stamp>/verdicts.json and copied into
// results.json and report.md, which are the files that go to GitHub.
// Videos never leave the box. LAN only: no login, do not expose to the internet.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComparisons, nextPair, ranking, savePick, undoPick, setups, comparePage, writeRankingToReport } from './compare.mjs';
import { loadBuilds } from './builds.mjs';
import { isExpRun, expRunBody, safePart, runLinkOf } from './exp-view.mjs';
import { buildRows, parseFilters, buildsBody, buildsCss } from './builds-view.mjs';
import { notesDir, loadNotes, addNote, requestShare, ID_RE } from './notes.mjs';

// The data (runs, grades, builds, todo) lives in QA box's working copy, QA_HOME; the code may run from another clone
// (the viewer service runs main's copy from RUNNER_HOME). Without QA_HOME both are this clone, as before.
const repo = path.resolve(process.env.QA_HOME || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const here = path.join(repo, 'qa');
const portArg = process.argv.indexOf('--port');
const port = portArg > 0 ? +process.argv[portArg + 1] : 8787;
// The Puggie worker container publishes no ports, so the viewer also listens on a Unix
// socket in the bind-mounted data folder; the host forwards :8787 to it (qa/README.md).
const sockArg = process.argv.indexOf('--socket');
const sock = sockArg > 0 ? process.argv[sockArg + 1] : null;
const VERDICTS = ['keep', 'maybe', 'dull'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safe = safePart;   // letters, digits, _ . @ - (exp-run's stills are named like default@1080p-1.png); never . or .. alone

function runs() {
  const out = [];
  for (const exp of fs.readdirSync(here)) {
    const dir = path.join(here, exp, 'runs');
    if (!fs.existsSync(dir)) continue;
    for (const stamp of fs.readdirSync(dir)) {
      const f = path.join(dir, stamp, 'results.json');
      if (fs.existsSync(f)) out.push({ exp, stamp, dir: path.join(dir, stamp) });
    }
  }
  return out.sort((a, b) => b.stamp.localeCompare(a.stamp));
}
const load = dir => JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
const loadVerdicts = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'verdicts.json'), 'utf8')); } catch { return {}; } };

function saveVerdict(dir, label, verdict, note) {
  const v = loadVerdicts(dir);
  v[label] = { verdict, note: note || '', at: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'verdicts.json'), JSON.stringify(v, null, 1));
  // keep results.json and report.md (the GitHub copies) in step
  const data = load(dir);
  for (const r of data.results) if (v[r.label]) { r.verdict = v[r.label].verdict; r.note = v[r.label].note; }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(data, null, 1));
  const rp = path.join(dir, 'report.md');
  if (fs.existsSync(rp)) {
    const md = fs.readFileSync(rp, 'utf8').split('\n').map(line => {
      const m = line.match(/^\| ([^|]+?) \|(.*)\| ([^|]*)\|$/);
      if (!m || !v[m[1]]) return line;
      return `| ${m[1]} |${m[2]}| ${v[m[1]].verdict}${v[m[1]].note ? ' — ' + v[m[1]].note.replace(/\|/g, '/') : ''} |`;
    }).join('\n');
    fs.writeFileSync(rp, md);
  }
  writeRankingToReport(dir, data.results.map(r => r.label));   // keeps the "User notes" section in step
}

const css = `:root{color-scheme:dark}body{margin:0;font:15px/1.45 system-ui,sans-serif;background:#0b0e14;color:#dde3ee}
header{padding:12px 14px;background:#121724}h1{font-size:17px;margin:0}a{color:#7fb0ff}main{padding:12px;max-width:760px;margin:0 auto}
.card{background:#121724;border:1px solid #2c3850;border-radius:12px;padding:10px;margin:12px 0}
video,img{width:100%;border-radius:8px;background:#000;display:block}.m{color:#8fa0bd;font-size:13px}
.score{font-size:22px;font-weight:700}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
button{font:inherit;background:#1a2234;color:#e6ecf7;border:1px solid #2c3850;border-radius:10px;padding:10px 14px}
button.on{background:#2b5cff;border-color:#2b5cff}input{font:inherit;flex:1;min-width:150px;background:#1a2234;color:#e6ecf7;border:1px solid #2c3850;border-radius:10px;padding:9px}
li{margin:8px 0}` + buildsCss;
const page = (title, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body><header><h1>${esc(title)}</h1><div class="m"><a href="/">builds</a> · <a href="/grade">grading</a></div></header><main>${body}</main></body></html>`;

// ---- start page: everything that waits for the user's eyes ----
// qa/todo.json holds the questions bots ask the user ({id, title, note?, links:[{label, href}], done?});
// runs show up by themselves, ungraded first.
const TODO = path.join(here, 'todo.json');
const loadTodo = () => { try { return JSON.parse(fs.readFileSync(TODO, 'utf8')); } catch { return []; } };

function runState(r) {
  // runner experiment folders (…-prN) have no results list
  const d = load(r.dir) || {}, n = Array.isArray(d.results) ? d.results.length : 0, picks = loadComparisons(r.dir).length, verdicts = Object.keys(loadVerdicts(r.dir)).length;
  const software = /SwiftShader|none/i.test(d.meta?.gpu || '');
  const target = Math.max(1, n - 1) * 2;            // two rounds of picks
  const graded = picks >= target || (verdicts >= n && n > 0);
  return { n, picks, verdicts, software, graded, target, tag: r.stamp.slice(16) || '' };
}

function indexPage() {
  const todo = loadTodo().filter(t => !t.done);
  const asks = todo.map(t => `<div class="card"><b>${esc(t.title)}</b>${t.note ? `<div class="m">${esc(t.note)}</div>` : ''}
    <div class="row">${(t.links || []).map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(' · ')}</div>
    <div class="row"><button onclick="fetch('/todo/${esc(t.id)}/done',{method:'POST'}).then(()=>location.reload())">✓ done</button>
    <span class="m">from ${esc(t.from || 'QA box')}</span></div></div>`).join('');
  const all = runs().map(r => ({ ...r, s: runState(r) }));
  const row = r => `<li><b>${esc(r.exp)}</b> · ${esc(r.stamp.slice(0, 15))}${r.s.tag ? ` <span class="m">${esc(r.s.tag)}</span>` : ''}<br>
    <a href="/run/${r.exp}/${r.stamp}/compare"><b>⇄ compare</b></a> · <a href="/run/${r.exp}/${r.stamp}">▶ watch all</a>
    <span class="m">· ${r.s.n} variants · ${r.s.picks}/${r.s.target} picks · ${r.s.verdicts} verdicts</span></li>`;
  const diag = r => !!r.s.tag;                       // tagged runs (branch checks, cover tests) are measurements, not swipe rounds
  const open = all.filter(r => !r.s.graded && !r.s.software && r.s.n > 1 && !diag(r));
  const done = all.filter(r => r.s.graded);
  const other = all.filter(r => !r.s.graded && (r.s.software || r.s.n <= 1 || diag(r)));
  const body = `
    <h2 style="font-size:16px">Waiting for you (${todo.length})</h2>${asks || '<div class="card">🎉 <b>You\'re all caught up.</b> <span class="m">Nothing is waiting for you; the bots will add things here.</span></div>'}
    <h2 style="font-size:16px">Runs to grade (${open.length})</h2>${open.length ? `<ul>${open.map(row).join('')}</ul>` : '<div class="card">✅ <b>No runs left to grade.</b> <span class="m">New runs show up here by themselves.</span></div>'}
    <h2 style="font-size:16px">Graded (${done.length})</h2>${done.length ? `<ul>${done.map(row).join('')}</ul>` : '<p class="m">None yet.</p>'}
    <details><summary class="m">Other runs (${other.length}): branch checks, software-only, single variant</summary><ul>${other.map(row).join('')}</ul></details>
    <h2 style="font-size:16px">Elsewhere</h2><ul>
      <li><a href="/"><b>Builds</b></a> <span class="m">— every build, its notes and who it is waiting on</span></li>
      <li><a href="https://github.com/users/borboss366/projects/1">Board (GitHub Projects)</a></li>
      <li><a href="https://github.com/borboss366/cellular-viz/pulls">Pull requests</a></li>
      <li><a href="https://borboss366.github.io/cellular-viz/">Experiments (live site)</a></li></ul>
    <p class="m">This page: http://192.168.8.164:8787/grade (home Wi-Fi only).</p>`;
  return page('QA: grading', body);
}

function runPage(exp, stamp, dir) {
  const d = load(dir), v = loadVerdicts(dir), m = d.meta || {};
  // a runner experiment folder (…-prN): stills, gates and check links, no videos to grade (exp-view.mjs)
  if (isExpRun(d)) {
    const sharedDirs = fs.readdirSync(dir).filter(n => /^shared(-[\w.-]+)?$/.test(n)).sort();
    return page(`${exp} · ${stamp}`, expRunBody(exp, stamp, d, rel => fs.existsSync(path.join(dir, ...rel.split('/'))), { sharedDirs }));
  }
  const cards = d.results.map((r, i) => {
    const a = r.agg || {}, cur = v[r.label] || {};
    const media = r.video && fs.existsSync(path.join(dir, r.video))
      ? `<video src="/file/${exp}/${stamp}/${r.video}" controls loop muted playsinline preload="metadata" poster="${stillOf(dir, i, r.label, exp, stamp)}"></video>`
      : `<img src="${stillOf(dir, i, r.label, exp, stamp)}" alt="">`;
    const q = (r.url || '').split('?')[1] || '';
    return `<div class="card" data-label="${esc(r.label)}">${media}
      <div class="row"><span class="score">${r.score ? r.score.total : '—'}</span><b>${esc(r.label)}</b></div>
      <div class="m">${r.error ? '⚠ ' + esc(r.error) : `cover ${(a.coverage * 100).toFixed(0)}% · motion ${a.motion?.toFixed(4)} ±${a.motionStd?.toFixed(4)} · colour ${a.colour?.toFixed(3)} · ${a.fps} fps`}</div>
      <div class="m">${esc(q)} · <a href="/experiments/${esc(m.exp || '')}?${esc(q)}" target="_blank">open live</a></div>
      <div class="row">${VERDICTS.map(x => `<button data-v="${x}" class="${cur.verdict === x ? 'on' : ''}">${x}</button>`).join('')}
        <input placeholder="note (optional)" value="${esc(cur.note)}"></div></div>`;
  }).join('');
  const head = `<p class="m">${esc(m.gpu || '')} · ${esc(m.renderer || '')}<br>warm-up ${m.warm}s · record ${m.dur}s${m.note ? '<br>⚠ ' + esc(m.note) : ''}</p>`;
  const js = `<script>
document.querySelectorAll('.card').forEach(card => {
  const label = card.dataset.label, note = card.querySelector('input');
  const send = v => fetch(location.pathname + '/verdict', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({label, verdict:v, note:note.value})})
    .then(r => { if (!r.ok) throw 0; card.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); })
    .catch(() => alert('not saved'));
  card.querySelectorAll('button').forEach(b => b.onclick = () => send(b.dataset.v));
  note.onchange = () => { const on = card.querySelector('button.on'); if (on) send(on.dataset.v); };
});</script>`;
  const cmp = `<p><a href="/run/${exp}/${stamp}/compare"><b>⇄ Compare two at a time</b></a> <span class="m">· ${loadComparisons(dir).length} picks so far</span></p>`;
  return page(`${exp} · ${stamp}`, cmp + head + cards + js);
}
function stillOf(dir, i, label, exp, stamp) {
  const f = `${String(i + 1).padStart(2, '0')}-${label.replace(/[^\w-]+/g, '-')}.png`;
  return fs.existsSync(path.join(dir, 'stills', f)) ? `/file/${exp}/${stamp}/stills/${f}` : '';
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.md': 'text/markdown; charset=utf-8', '.log': 'text/plain; charset=utf-8' };
function sendFile(req, res, p) {
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  const size = fs.statSync(p).size, type = types[path.extname(p)] || 'application/octet-stream';
  const range = req.headers.range && req.headers.range.match(/bytes=(\d*)-(\d*)/);
  if (range) { // video seeking on phones needs ranges
    const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    return fs.createReadStream(p, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
  fs.createReadStream(p).pipe(res);
}

function compareRoute(req, res, exp, stamp, dir, action) {
  const json = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const data = load(dir);
  if (isExpRun(data)) {   // nothing to compare in an experiment folder: its swipe run if it has one, else its stills
    res.writeHead(302, { location: data.swipe && typeof data.swipe.url === 'string' && data.swipe.url.startsWith('/run/') ? data.swipe.url : `/run/${encodeURIComponent(exp)}/${encodeURIComponent(stamp)}` });
    return res.end();
  }
  const usable = data.results.filter(r => r.video && fs.existsSync(path.join(dir, r.video)));
  const labels = usable.map(r => r.label);
  if (!action) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page(`${exp} · ${stamp} · compare`, comparePage(exp, stamp))); }
  if (action === 'next') {
    const comps = loadComparisons(dir), su = setups(data.results), per = Math.max(1, labels.length - 1);
    const pair = nextPair(labels, comps);
    const info = l => { const i = data.results.findIndex(r => r.label === l), r = data.results[i];
      return { label: l, setup: su[l], video: `/file/${exp}/${stamp}/${r.video}`, still: stillOf(dir, i, l, exp, stamp), note: (loadVerdicts(dir)[l] || {}).note || '' }; };
    // after two rounds the run counts as graded: say so, and point at the next thing to grade
    const target = per * 2;
    const next = runs().map(r => ({ ...r, s: runState(r) }))
      .find(r => !(r.exp === exp && r.stamp === stamp) && !r.s.graded && !r.s.software && r.s.n > 1 && !r.s.tag);
    return json({ pair: pair && pair.map(info), count: comps.length, round: Math.floor(comps.length / per) + 1, inRound: comps.length % per, perRound: per,
      target, done: comps.length >= target, nextRun: next ? `/run/${next.exp}/${next.stamp}/compare` : null,
      openAsks: loadTodo().filter(t => !t.done).length, ranking: ranking(labels, comps) });
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (action === 'undo') { undoPick(dir, labels); return json({ ok: true }); }
  if (action === 'pick') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => {
      try {
        const { a, b, winner, note } = JSON.parse(body);
        if (!labels.includes(a) || !labels.includes(b) || a === b || ![a, b, 'tie'].includes(winner)) throw new Error('bad pick');
        savePick(dir, labels, { a, b, winner, note: String(note || '').trim().slice(0, 500) });
        json({ ok: true });
      } catch (e) { json({ error: e.message }, 400); }
    });
    return;
  }
  if (action === 'note') {   // a note on one look from the compare page: kept with its keep/maybe/dull verdict
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => {
      try {
        const { label, note } = JSON.parse(body);
        if (!data.results.some(r => r.label === label)) throw new Error('bad label');
        const old = loadVerdicts(dir)[label] || {};
        saveVerdict(dir, label, old.verdict || '', String(note || '').trim().slice(0, 500));
        json({ ok: true });
      } catch (e) { json({ error: e.message }, 400); }
    });
    return;
  }
  json({ error: 'not found' }, 404);
}

// ---- builds: one row per open PR (latest round), tap for that PR's rounds (qa/builds.json, written by qa/builds.mjs) ----
const CHIP = { queued: ['#5b6478', 'queued'], running: ['#2b5cff', 'running'], failed: ['#d6455d', 'failed'], ready: ['#2bd96b', 'ready to merge'], merged: ['#3a4560', 'merged'], closed: ['#3a4560', 'closed'] };
const chip = st => { const [c, t] = CHIP[st] || ['#5b6478', st]; return `<span style="background:${c};color:#fff;border-radius:8px;padding:2px 8px;font-size:12px;white-space:nowrap">${esc(t)}</span>`; };
const ago = iso => { if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const gatesCell = b => (b.gates || []).length ? `${b.gates.filter(g => g.ok).length}/${b.gates.length}` : '–';
const waitTxt = { dev: 'VIZ dev', 'qa-box': 'QA box', user: 'you' };
// the viewer page of a build's run folder (stills, gates), when that folder has a results.json the run page can read
const runLink = b => { const l = runLinkOf(b.report); return l && fs.existsSync(path.join(repo, path.dirname(b.report), 'results.json')) ? l : null; };
// the build's folder (where its check.md is), inside QA_HOME's qa/, or null
function buildDir(b) {
  if (typeof b.report !== 'string' || !b.report.startsWith('qa/') || !b.report.split('/').every(safe)) return null;
  return path.join(repo, path.dirname(b.report));
}
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
// the build's first still: exp-run's runs[].stills, else the first .png in its stills/ folder, else in its folder
function firstStill(b) {
  const dir = buildDir(b); if (!dir || !fs.existsSync(dir)) return null;
  const d = readJson(path.join(dir, 'results.json'));
  const listed = d && Array.isArray(d.runs) ? d.runs.flatMap(r => (Array.isArray(r.stills) ? r.stills : [])) : [];
  for (const rel of listed) if (typeof rel === 'string' && rel.split('/').every(safe) && fs.existsSync(path.join(dir, ...rel.split('/')))) return path.join(dir, ...rel.split('/'));
  for (const sub of ['stills', '.']) {
    const p = path.join(dir, sub);
    try { const f = fs.readdirSync(p).filter(n => /\.png$/.test(n) && safe(n)).sort()[0]; if (f) return path.join(p, f); } catch {}
  }
  return null;
}
// what /grade holds, for the link at the top of /builds: the bots' open asks and the runs still to grade
function gradeCounts() {
  const asks = loadTodo().filter(t => !t.done).length;
  const toGrade = runs().map(r => ({ ...r, s: runState(r) })).filter(r => !r.s.graded && !r.s.software && r.s.n > 1 && !r.s.tag).length;
  return { asks, toGrade };
}
function buildsPage(query) {
  const NOTES = notesDir();
  let g = { asks: 0, toGrade: 0 }; try { g = gradeCounts(); } catch {}
  const rows = buildRows(loadBuilds(), b => {
    const dir = buildDir(b);
    if (!dir) return {};
    let checkMd = null; try { checkMd = fs.readFileSync(path.join(dir, 'check.md'), 'utf8'); } catch {}
    return { results: readJson(path.join(dir, 'results.json')), checkMd, thumb: !!firstStill(b), stills: runLink(b) };
  });
  return page('Builds', `<div class="card"><a href="/grade"><b>Grading →</b></a> <span class="m">${g.asks} waiting for you · ${g.toGrade} runs to grade</span></div>
    <p class="m"><a href="/builds/open">open PRs only (latest round each)</a></p>`
    + buildsBody(rows, parseFilters(query), id => { try { return loadNotes(NOTES, id); } catch { return []; } }));
}
// the old list: one row per open PR (its latest round)
function openBuildsPage() {
  const all = loadBuilds(), last = new Map();
  for (const b of all) { const k = `${b.kind}/${b.pr}`, cur = last.get(k); if (!cur || b.round > cur.round) last.set(k, b); }
  const gone = b => b.status === 'merged' || b.status === 'closed';   // closed unmerged PRs leave the live list too
  const rows = [...last.values()].sort((a, b) => gone(a) - gone(b) || Date.parse(b.at) - Date.parse(a.at));
  const open = rows.filter(b => !gone(b)), merged = rows.filter(gone);
  const tr = b => `<tr onclick="location='/builds/${esc(b.kind)}/${b.pr}'" style="cursor:pointer"><td><b>${esc(b.page)}</b><br><span class="m">#${b.pr} · ${esc(b.commit)} · round ${b.round}</span></td>
    <td>${chip(b.status)}</td><td>${gatesCell(b)}</td><td>${b.waitingOn ? esc(waitTxt[b.waitingOn] || b.waitingOn) : ''}</td><td class="m">${ago(b.at)}</td>
    <td>${b.report ? `<a href="/report/${esc(b.report)}" onclick="event.stopPropagation()">report</a>` : ''}${runLink(b) ? ` · <a href="${runLink(b)}" onclick="event.stopPropagation()">stills</a>` : ''}${b.swipe ? ` · <a href="${esc(b.swipe)}" onclick="event.stopPropagation()">swipe</a>` : ''}</td></tr>`;
  const table = list => `<table style="width:100%;border-collapse:collapse;font-size:14px"><tr class="m"><th align=left>page</th><th align=left>status</th><th align=left>gates</th><th align=left>waiting on</th><th align=left>last</th><th></th></tr>${list.map(tr).join('')}</table>`;
  return page('Builds', `<p class="m"><a href="/builds">← every build, with notes</a> · one build = one check round of one commit. Latest round per PR; tap a row for its history.</p>
    <div class="card">${open.length ? table(open) : 'Nothing open.'}</div>
    ${merged.length ? `<details><summary class="m">Merged or closed (${merged.length})</summary><div class="card">${table(merged)}</div></details>` : ''}`);
}
function buildPage(kind, pr) {
  const list = loadBuilds().filter(b => b.kind === kind && String(b.pr) === String(pr)).sort((a, b) => b.round - a.round);
  if (!list.length) return page('Builds', '<p>No builds for this PR.</p>');
  const card = b => `<div class="card" id="round-${b.round}"><b>Round ${b.round}</b> · ${esc(b.commit)} ${chip(b.status)} <span class="m">gates ${gatesCell(b)} · ${b.finished ? 'finished ' + ago(b.finished) + ' ago' : 'started ' + ago(b.started) + ' ago'}</span>
    ${b.gates.filter(g => !g.ok).map(g => `<div class="m">❌ ${esc(g.name)}${g.value ? ': ' + esc(g.value.slice(0, 160)) : ''}</div>`).join('')}
    <div class="row">${b.report ? `<a href="/report/${esc(b.report)}">report</a>` : ''}${runLink(b) ? ` · <a href="${runLink(b)}">stills</a>` : ''}${b.swipe ? ` · <a href="${esc(b.swipe)}">swipe</a>` : ''}</div></div>`;
  return page(`${list[0].page} · #${pr}`, `<p class="m"><a href="/builds">← all builds</a> · <a href="https://github.com/borboss366/cellular-viz/pull/${esc(pr)}">PR #${esc(pr)}</a></p>${list.map(card).join('')}`);
}

// ---- proposals: "pick which to build" (qa/proposals/<id>/proposal.json + pictures; picks → picks.json) ----
const PROP = path.join(here, 'proposals');
function pickPage(id) {
  const P = JSON.parse(fs.readFileSync(path.join(PROP, id, 'proposal.json'), 'utf8'));
  let picks = {}; try { picks = JSON.parse(fs.readFileSync(path.join(PROP, id, 'picks.json'), 'utf8')); } catch {}
  const chosen = new Set(picks.chosen || []);
  const cards = P.items.map(it => `<label class="card" style="display:block;cursor:pointer">
    <div class="row" style="margin:0 0 8px"><input type="checkbox" name="pick" value="${esc(it.id)}" ${chosen.has(it.id) ? 'checked' : ''} style="flex:none;width:28px;height:28px;min-width:0">
      <b style="font-size:17px">${esc(it.id)} · ${esc(it.name)}</b></div>
    <img src="/proposal/${esc(id)}/${esc(it.img)}" alt="" style="background:#05070c">
    <p>${esc(it.see)}</p><p class="m"><b>Music:</b> ${esc(it.music)}<br><b>QA check:</b> ${esc(it.check)}</p></label>`).join('');
  return page(P.title, `<p class="m">${esc(P.intro)}</p><p class="m"><i>${esc(P.note)}</i></p>${cards}
    ${P.combos ? `<p class="m">${esc(P.combos)}</p>` : ''}
    <div class="card"><input id="note" placeholder="note for the bots (optional)" value="${esc(picks.note || '')}" style="width:100%;box-sizing:border-box">
    <div class="row"><button class="on" id="save">Save my picks</button><span class="m" id="st">${picks.at ? 'saved ' + esc(picks.at.slice(0, 16).replace('T', ' ')) + ' UTC: ' + esc((picks.chosen || []).join(', ') || 'none') : ''}</span></div></div>
    <p class="m">Source: ${esc(P.source)}</p>
    <script>document.getElementById('save').onclick = () => {
      const chosen = [...document.querySelectorAll('input[name=pick]:checked')].map(x => x.value);
      fetch(location.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chosen, note: document.getElementById('note').value }) })
        .then(r => r.ok ? r.text() : Promise.reject()).then(() => { document.getElementById('st').textContent = 'saved: ' + (chosen.join(', ') || 'none'); })
        .catch(() => alert('not saved'));
    };</script>`);
}

const handler = (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const html = s => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(s); };
  try {
    if (!parts.length) return html(buildsPage(url.searchParams));   // the viewer opens on the builds (#162)
    if (parts[0] === 'grade' && parts.length === 1) return html(indexPage());
    if (parts[0] === 'run' && parts.length >= 3 && safe(parts[1]) && safe(parts[2])) {
      const dir = path.join(here, parts[1], 'runs', parts[2]);
      if (!fs.existsSync(path.join(dir, 'results.json'))) { res.writeHead(404); return res.end('no such run'); }
      if (parts[3] === 'verdict' && req.method === 'POST') {
        let body = '';
        req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
        req.on('end', () => {
          try {
            const { label, verdict, note } = JSON.parse(body);
            if (!VERDICTS.includes(verdict) || !load(dir).results.some(r => r.label === label)) throw new Error('bad verdict');
            saveVerdict(dir, label, verdict, String(note || '').slice(0, 500));
            res.writeHead(200); res.end('ok');
          } catch (e) { res.writeHead(400); res.end(String(e.message)); }
        });
        return;
      }
      if (parts[3] === 'compare') return compareRoute(req, res, parts[1], parts[2], dir, parts[4]);
      return html(runPage(parts[1], parts[2], dir));
    }
    if (parts[0] === 'builds' && parts.length === 1) return html(buildsPage(url.searchParams));
    if (parts[0] === 'builds' && parts.length === 2 && parts[1] === 'open') return html(openBuildsPage());
    if (parts[0] === 'thumb' && parts.length === 2 && ID_RE.test(parts[1])) {
      const b = loadBuilds().find(x => x.id === parts[1]), f = b && firstStill(b);
      if (!f) { res.writeHead(404); return res.end('no still'); }
      return sendFile(req, res, f);
    }
    // notes (#162): saved on the box; private unless shared, and the runner posts shared ones to the PR (qa/notes.mjs)
    if (parts[0] === 'notes' && req.method === 'POST' && ID_RE.test(parts[1] || '') && (parts.length === 2 || (parts.length === 4 && /^\d+$/.test(parts[2]) && parts[3] === 'share'))) {
      if (!loadBuilds().some(x => x.id === parts[1])) { res.writeHead(404); return res.end('no such build'); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 2e4) req.destroy(); });
      req.on('end', () => {
        try {
          const e = parts.length === 4 ? requestShare(notesDir(), parts[1], +parts[2])
            : addNote(notesDir(), parts[1], (JSON.parse(body || '{}') || {}).text, { share: !!(JSON.parse(body || '{}') || {}).share });
          res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(e));
        } catch (err) { res.writeHead(400); res.end(String(err.message)); }
      });
      return;
    }
    // /builds/155/4 (PR, round) and /builds/viz-155-4 (a build id): send them to the PR's page at that round
    if (parts[0] === 'builds' && parts[1] !== 'open' && (parts.length === 2 || (parts.length === 3 && /^\d+$/.test(parts[1]))) && safe(parts[1])) {
      const m = parts.length === 3 ? { pr: parts[1], round: parts[2] } : (parts[1].match(/^[a-z]+-(?<pr>\d+)-(?<round>\d+)$/) || {}).groups;
      const b = m && loadBuilds().filter(x => String(x.pr) === m.pr).sort((x, y) => (String(x.round) === m.round) - (String(y.round) === m.round) || x.round - y.round).pop();
      if (!b) return html(page('Builds', `<p>No builds for ${esc(parts.slice(1).join('/'))}. <a href="/builds">All builds</a></p>`));
      res.writeHead(302, { location: `/builds/${encodeURIComponent(b.kind)}/${b.pr}#round-${b.round}` }); return res.end();
    }
    if (parts[0] === 'builds' && parts.length === 3 && safe(parts[1]) && /^\d+$/.test(parts[2])) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(buildPage(parts[1], parts[2])); }
    if (parts[0] === 'report' && parts[1] === 'qa' && parts.length >= 4 && parts.slice(1).every(safe) && parts.at(-1) === 'check.md') {   // check reports only
      const f = path.join(repo, ...parts.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); return res.end(fs.readFileSync(f));
    }
    if (parts[0] === 'todo' && parts[2] === 'done' && req.method === 'POST' && safe(parts[1] || '')) {
      const t = loadTodo(), item = t.find(x => x.id === parts[1]);
      if (!item) { res.writeHead(404); return res.end('no such item'); }
      item.done = new Date().toISOString();
      fs.writeFileSync(TODO, JSON.stringify(t, null, 1));
      res.writeHead(200); return res.end('ok');
    }
    if (parts[0] === 'pick' && parts.length === 2 && safe(parts[1]) && fs.existsSync(path.join(PROP, parts[1], 'proposal.json'))) {
      if (req.method === 'POST') {
        let body = ''; req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
        req.on('end', () => { try {
          const { chosen, note } = JSON.parse(body); const ids = JSON.parse(fs.readFileSync(path.join(PROP, parts[1], 'proposal.json'), 'utf8')).items.map(i => i.id);
          if (!Array.isArray(chosen) || chosen.some(c => !ids.includes(c))) throw new Error('bad pick');
          fs.writeFileSync(path.join(PROP, parts[1], 'picks.json'), JSON.stringify({ chosen, note: String(note || '').slice(0, 500), at: new Date().toISOString() }, null, 1));
          res.writeHead(200); res.end('ok'); } catch (e) { res.writeHead(400); res.end(e.message); } });
        return;
      }
      return html(pickPage(parts[1]));
    }
    if (parts[0] === 'proposal' && parts.length === 3 && safe(parts[1]) && safe(parts[2])) return sendFile(req, res, path.join(PROP, parts[1], parts[2]));
    if (parts[0] === 'file' && parts.length >= 4 && safe(parts[1]) && safe(parts[2]) && parts.slice(3).every(safe)) {
      return sendFile(req, res, path.join(here, parts[1], 'runs', parts[2], ...parts.slice(3)));
    }
    if (parts[0] === 'experiments' && parts.length === 2 && safe(parts[1])) {
      return sendFile(req, res, path.join(repo, 'experiments', parts[1])); // "open live" link
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    // a route that already sent its headers and then threw used to crash the whole viewer here (27 Oct, ERR_HTTP_HEADERS_SENT)
    console.error(`${new Date().toISOString()} ${req.method} ${req.url}: ${e.stack || e.message}`);
    if (!res.headersSent) res.writeHead(500);
    try { res.end(String(e.message)); } catch {}
  }
};
// last line of defence: log and keep serving instead of taking the grading page down
process.on('uncaughtException', e => console.error(`${new Date().toISOString()} uncaught: ${e.stack || e.message}`));
http.createServer(handler).listen(port, '0.0.0.0', () => console.log(`QA viewer on :${port}`));
if (sock) {
  try { fs.unlinkSync(sock); } catch {}
  http.createServer(handler).listen(sock, () => { fs.chmodSync(sock, 0o600); console.log(`QA viewer on ${sock}`); });
}
