// QA viewer on the box: watch every run's videos and grade them from the phone.
//
//   node qa/serve.mjs [--port 8787]      → http://<box>:8787/
//
// Pages: /                 list of runs (newest first)
//        /run/<exp>/<stamp> videos + scores + keep / maybe / dull
// Verdicts are saved to qa/<exp>/runs/<stamp>/verdicts.json and copied into
// results.json and report.md, which are the files that go to GitHub.
// Videos never leave the box. LAN only: no login, do not expose to the internet.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComparisons, nextPair, ranking, savePick, undoPick, setups, comparePage } from './compare.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const portArg = process.argv.indexOf('--port');
const port = portArg > 0 ? +process.argv[portArg + 1] : 8787;
// The Puggie worker container publishes no ports, so the viewer also listens on a Unix
// socket in the bind-mounted data folder; the host forwards :8787 to it (qa/README.md).
const sockArg = process.argv.indexOf('--socket');
const sock = sockArg > 0 ? process.argv[sockArg + 1] : null;
const VERDICTS = ['keep', 'maybe', 'dull'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safe = s => /^[\w.-]+$/.test(s);

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
}

const css = `:root{color-scheme:dark}body{margin:0;font:15px/1.45 system-ui,sans-serif;background:#0b0e14;color:#dde3ee}
header{padding:12px 14px;background:#121724}h1{font-size:17px;margin:0}a{color:#7fb0ff}main{padding:12px;max-width:760px;margin:0 auto}
.card{background:#121724;border:1px solid #2c3850;border-radius:12px;padding:10px;margin:12px 0}
video,img{width:100%;border-radius:8px;background:#000;display:block}.m{color:#8fa0bd;font-size:13px}
.score{font-size:22px;font-weight:700}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
button{font:inherit;background:#1a2234;color:#e6ecf7;border:1px solid #2c3850;border-radius:10px;padding:10px 14px}
button.on{background:#2b5cff;border-color:#2b5cff}input{font:inherit;flex:1;min-width:150px;background:#1a2234;color:#e6ecf7;border:1px solid #2c3850;border-radius:10px;padding:9px}
li{margin:8px 0}`;
const page = (title, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body><header><h1>${esc(title)}</h1><div class="m"><a href="/">all runs</a></div></header><main>${body}</main></body></html>`;

// ---- start page: everything that waits for the user's eyes ----
// qa/todo.json holds the questions bots ask the user ({id, title, note?, links:[{label, href}], done?});
// runs show up by themselves, ungraded first.
const TODO = path.join(here, 'todo.json');
const loadTodo = () => { try { return JSON.parse(fs.readFileSync(TODO, 'utf8')); } catch { return []; } };

function runState(r) {
  const d = load(r.dir), n = d.results.length, picks = loadComparisons(r.dir).length, verdicts = Object.keys(loadVerdicts(r.dir)).length;
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
      <li><a href="https://github.com/users/borboss366/projects/1">Board (GitHub Projects)</a></li>
      <li><a href="https://github.com/borboss366/cellular-viz/pulls">Pull requests</a></li>
      <li><a href="https://borboss366.github.io/cellular-viz/">Experiments (live site)</a></li></ul>
    <p class="m">Bookmark this page: http://192.168.8.164:8787/ (home Wi-Fi only).</p>`;
  return page('QA: what needs you', body);
}

function runPage(exp, stamp, dir) {
  const d = load(dir), v = loadVerdicts(dir), m = d.meta || {};
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

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webm': 'video/webm', '.md': 'text/markdown; charset=utf-8', '.log': 'text/plain; charset=utf-8' };
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
  const usable = data.results.filter(r => r.video && fs.existsSync(path.join(dir, r.video)));
  const labels = usable.map(r => r.label);
  if (!action) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page(`${exp} · ${stamp} · compare`, comparePage(exp, stamp))); }
  if (action === 'next') {
    const comps = loadComparisons(dir), su = setups(data.results), per = Math.max(1, labels.length - 1);
    const pair = nextPair(labels, comps);
    const info = l => { const i = data.results.findIndex(r => r.label === l), r = data.results[i];
      return { label: l, setup: su[l], video: `/file/${exp}/${stamp}/${r.video}`, still: stillOf(dir, i, l, exp, stamp) }; };
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
        const { a, b, winner } = JSON.parse(body);
        if (!labels.includes(a) || !labels.includes(b) || a === b || ![a, b, 'tie'].includes(winner)) throw new Error('bad pick');
        savePick(dir, labels, { a, b, winner });
        json({ ok: true });
      } catch (e) { json({ error: e.message }, 400); }
    });
    return;
  }
  json({ error: 'not found' }, 404);
}

const handler = (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const html = s => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(s); };
  try {
    if (!parts.length) return html(indexPage());
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
            saveVerdict(dir, label, verdict, String(note || '').slice(0, 300));
            res.writeHead(200); res.end('ok');
          } catch (e) { res.writeHead(400); res.end(String(e.message)); }
        });
        return;
      }
      if (parts[3] === 'compare') return compareRoute(req, res, parts[1], parts[2], dir, parts[4]);
      return html(runPage(parts[1], parts[2], dir));
    }
    if (parts[0] === 'todo' && parts[2] === 'done' && req.method === 'POST' && safe(parts[1] || '')) {
      const t = loadTodo(), item = t.find(x => x.id === parts[1]);
      if (!item) { res.writeHead(404); return res.end('no such item'); }
      item.done = new Date().toISOString();
      fs.writeFileSync(TODO, JSON.stringify(t, null, 1));
      res.writeHead(200); return res.end('ok');
    }
    if (parts[0] === 'file' && parts.length >= 4 && safe(parts[1]) && safe(parts[2]) && parts.slice(3).every(safe)) {
      return sendFile(req, res, path.join(here, parts[1], 'runs', parts[2], ...parts.slice(3)));
    }
    if (parts[0] === 'experiments' && parts.length === 2 && safe(parts[1])) {
      return sendFile(req, res, path.join(repo, 'experiments', parts[1])); // "open live" link
    }
    res.writeHead(404); res.end('not found');
  } catch (e) { res.writeHead(500); res.end(String(e.message)); }
};
http.createServer(handler).listen(port, '0.0.0.0', () => console.log(`QA viewer on :${port}`));
if (sock) {
  try { fs.unlinkSync(sock); } catch {}
  http.createServer(handler).listen(sock, () => { fs.chmodSync(sock, 0o600); console.log(`QA viewer on ${sock}`); });
}
