#!/usr/bin/env node
// The conductor page's local server (#188 Task 1): the page, the private tracks and their reference grids, and the
// session log. Separate from the QA viewer (qa/serve.mjs, the box's grading page): this one runs where the user plays,
// on the laptop or the box, and listens on 127.0.0.1 unless told otherwise.
//
//   node qa/conduct-serve.mjs [--dir <tracks dir>] [--sessions <dir>] [--port 8790] [--host 127.0.0.1] [--socket <path>]
//     (R9: the folders also come from CONDUCTOR_TRACKS / CONDUCTOR_SESSIONS, env only, never committed)
//     → http://127.0.0.1:8790/  (opens experiments/clock-conductor.html)
//   --socket: listen on a Unix socket instead of TCP (a stale socket file is removed first; mode 0600). On the box the
//     container publishes no ports, so qa/runner/conductor.sh puts it in the bind-mounted data folder and the host's
//     cellular-viz-conductor.socket/.service (systemd-socket-proxyd) forward :8790 to it, like the 8787 viewer.
//
// Routes:
//   GET  /                       → /experiments/clock-conductor.html
//   GET  /experiments/<file>     the repo's pages and their shared code (.html .js .mjs .css .json)
//   GET  /qa/<file>.mjs          only the browser-safe modules the page imports (BROWSER_MODULES)
//   GET  /api/tracks             [{ idx, label, id, kind: 'track' | 'mix', grid: bool, marks }]  (label: the file stem,
//                                shown on this machine only; id: the corpus id from corpus-map.json, or the mix name;
//                                marks: the names qa/corpus.json lists for that id, for the page's mark menu)
//   GET  /audio/s/<stem>         the track's bytes by its file stem (Range supported); what the page uses (the list on
//                                the page can be older than the folder: hc-09 once played another track, 14 Nov)
//   GET  /grid/s/<stem>          its reference grid (<stem>.beatgrid.json), 404 without one
//   GET  /audio/<idx>[?stem=s]   the same by place in the list; with ?stem= and another track at that place: 409
//   GET  /grid/<idx>[?stem=s]    { error: 'track list changed' }
//   Every audio and grid answer carries X-Track-Stem (the stem, URI-encoded), so the page can check what it got.
//   POST /log/<session>          JSONL lines appended to <sessions>/<session>.jsonl; every line must fit schema v1
//                                (qa/conduct-score.mjs checkRecord) and stay ≤ 64 KB (R9), else 400 and nothing is written
//   GET  /log/<session>          the session so far (the page's download)
// The tracks are read, never copied or listed outside this server; the session logs stay in the sessions folder
// (default: beside the tracks folder), outside git (R9).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceTracks, audioDir } from './runner/audio.mjs';
import { loadMap } from './corpus.mjs';
import { checkRecord } from './conduct-score.mjs';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BROWSER_MODULES = ['marks.mjs', 'conduct-log.mjs'];
export const SESSION_RE = /^conductor-\d{8}-\d{6}(-[a-z0-9]{1,8})?$/;
export const MAX_POST = 4 << 20, MAX_LINE = 64 << 10;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.flac': 'audio/flac', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.aif': 'audio/aiff', '.aiff': 'audio/aiff' };
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(html|js|mjs|css|json)$/;

/** the playable list: source tracks (corpus ids from the map) then the built mixes in renders/ (id = mix name) */
export function listTracks(dir) {
  let map = { tracks: {} };
  try { map = loadMap(dir); } catch { /* a broken map: no ids */ }
  const idOf = Object.fromEntries(Object.entries(map.tracks || {}).map(([id, stem]) => [stem, id]));
  const out = sourceTracks(dir).map(t => ({ stem: t.stem, path: path.join(dir, t.file), id: idOf[t.stem] || null, kind: 'track', gridPath: path.join(dir, `${t.stem}.beatgrid.json`) }));
  const rd = path.join(dir, 'renders');
  let mixes = [];
  try { mixes = fs.readdirSync(rd).filter(f => /^mix-[a-z0-9-]+\.wav$/.test(f)).sort(); } catch { /* no renders yet */ }
  for (const f of mixes) { const stem = f.slice(0, -4); out.push({ stem, path: path.join(rd, f), id: stem, kind: 'mix', gridPath: path.join(rd, `${stem}.beatgrid.json`) }); }
  return out.map((t, idx) => ({ ...t, idx, grid: fs.existsSync(t.gridPath) }));
}

function sendFile(req, res, file, type, extra = {}) {
  let st;
  try { st = fs.statSync(file); } catch { return send(res, 404, 'not found'); }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const head = { 'content-type': type || TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'no-store', ...extra };
  if (range && (range[1] || range[2])) {
    let a = range[1] ? +range[1] : st.size - +range[2], b = range[1] && range[2] ? +range[2] : st.size - 1;
    if (!(a >= 0 && a <= b && b < st.size)) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'content-range': `bytes ${a}-${b}/${st.size}`, 'content-length': b - a + 1 });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { ...head, 'content-length': st.size });
  return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
}
const send = (res, code, body, type = 'text/plain; charset=utf-8') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), 'application/json');

/** lines → the problems ([] when every line parses and fits schema v1), naming the line */
export function checkLines(text) {
  const errs = [];
  String(text).split('\n').forEach((l, i) => {
    if (!l.trim()) return;
    if (Buffer.byteLength(l) > MAX_LINE) { errs.push(`line ${i + 1}: over 64 KB`); return; }
    let r;
    try { r = JSON.parse(l); } catch { errs.push(`line ${i + 1}: not JSON`); return; }
    for (const e of checkRecord(r)) errs.push(`line ${i + 1}: ${e}`);
  });
  return errs;
}

/** the request handler for a tracks folder and a sessions folder (node-tested without a socket of its own) */
export function createHandler({ tracksDir, sessionsDir, repo = REPO }) {
  return (req, res) => {
    const url = new URL(req.url, 'http://local');
    const parts = url.pathname.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return '\u0000'; } });
    try {
      if (req.method === 'GET' && !parts.length) { res.writeHead(302, { location: '/experiments/clock-conductor.html' }); return res.end(); }
      if ((req.method === 'GET' || req.method === 'HEAD') && parts[0] === 'experiments' && parts.length === 2 && SAFE_FILE.test(parts[1])) {
        return sendFile(req, res, path.join(repo, 'experiments', parts[1]));
      }
      if (req.method === 'GET' && parts[0] === 'qa' && parts.length === 2 && BROWSER_MODULES.includes(parts[1])) return sendFile(req, res, path.join(repo, 'qa', parts[1]));
      if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'tracks' && parts.length === 2) {
        let rows = [];
        try { rows = JSON.parse(fs.readFileSync(path.join(repo, 'qa', 'corpus.json'), 'utf8')); } catch { /* no corpus: no mark names */ }
        const marksOf = Object.fromEntries(rows.map(r => [r.id, r.marks || []]));
        return json(res, 200, listTracks(tracksDir).map(t => ({ idx: t.idx, label: t.stem, id: t.id, kind: t.kind, grid: t.grid, marks: (t.id && marksOf[t.id]) || [] })));
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && (parts[0] === 'audio' || parts[0] === 'grid')) {
        // by stem (/audio/s/<stem>), or by place with an optional ?stem= check (409 when the list has moved)
        const serve = t => {
          const extra = { 'x-track-stem': encodeURIComponent(t.stem) };
          return parts[0] === 'audio' ? sendFile(req, res, t.path, undefined, extra) : sendFile(req, res, t.gridPath, 'application/json', extra);
        };
        if (parts.length === 3 && parts[1] === 's') {
          const t = listTracks(tracksDir).find(x => x.stem === parts[2]);
          return t ? serve(t) : send(res, 404, 'no such track');
        }
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
          const t = listTracks(tracksDir)[+parts[1]];
          if (!t) return send(res, 404, 'no such track');
          const want = url.searchParams.get('stem');
          if (want !== null && want !== t.stem) return json(res, 409, { error: 'track list changed', idx: +parts[1] });
          return serve(t);
        }
      }
      if (parts[0] === 'log' && parts.length === 2 && SESSION_RE.test(parts[1])) {
        const file = path.join(sessionsDir, `${parts[1]}.jsonl`);
        if (req.method === 'GET') return sendFile(req, res, file, 'application/x-ndjson');
        if (req.method === 'POST') {
          const chunks = [];
          let size = 0;
          req.on('data', c => { size += c.length; if (size <= MAX_POST) chunks.push(c); });
          req.on('end', () => {
            if (size > MAX_POST) return json(res, 413, { error: 'too large' });
            const text = Buffer.concat(chunks).toString('utf8');
            const errs = checkLines(text);
            if (errs.length) return json(res, 400, { error: 'schema v1', lines: errs.slice(0, 20) });
            fs.mkdirSync(sessionsDir, { recursive: true });
            const body = text.split('\n').filter(l => l.trim()).join('\n');
            if (body) fs.appendFileSync(file, body + '\n');
            return json(res, 200, { ok: true, lines: body ? body.split('\n').length : 0 });
          });
          return undefined;
        }
      }
      return send(res, 404, 'not found');
    } catch (e) {
      return send(res, 500, String(e && e.message || e));
    }
  };
}

/** listen on a Unix socket: a stale socket file (left by a crash) is removed first, then the socket is made 0600 */
export function listenSocket(server, sock) {
  try { if (!fs.lstatSync(sock).isDirectory()) fs.unlinkSync(sock); } catch { /* none there */ }
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(sock, () => { server.off('error', reject); fs.chmodSync(sock, 0o600); resolve(sock); });
  });
}

function main(argv) {
  const args = argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const tracksDir = audioDir(opt('--dir') || process.env.CONDUCTOR_TRACKS || undefined);
  const sessionsDir = path.resolve(opt('--sessions', process.env.CONDUCTOR_SESSIONS || path.join(path.dirname(tracksDir), 'sessions')));
  const port = +opt('--port', 8790), host = opt('--host', '127.0.0.1'), sock = opt('--socket');
  const n = listTracks(tracksDir).length;
  const server = http.createServer(createHandler({ tracksDir, sessionsDir }));
  if (sock) {
    listenSocket(server, sock).then(() => console.log(`conductor on ${sock} (${n} track(s); logs → ${sessionsDir})`),
      e => { console.error(`conductor: cannot listen on ${sock}: ${e.message}`); process.exit(1); });
    for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => server.close(() => process.exit(0)));
    return;
  }
  server.listen(port, host, () =>
    console.log(`conductor on http://${host}:${port}/ (${n} track(s); logs → ${sessionsDir})`));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
