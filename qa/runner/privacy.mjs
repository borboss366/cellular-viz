// Q10 (#188, the conductor brief; R9): the page may send nothing anywhere except its own session log. On exp-run's
// 127.0.0.1 server the only write is a same-origin POST to /log: JSON lines, each body ≤ 64 KB. Every request the
// server sees, every request the page makes to another origin and every WebSocket it opens goes into a request log,
// and privacyRow() turns that log into the check.md row. Pure checks plus one node http handler, so node tests cover
// them; exp-run.mjs wires them up when the experiment sets "privacy": true.
export const LOG_PATH = '/log', LOG_MAX = 64 * 1024;
const JSON_TYPES = ['application/json', 'application/x-ndjson', 'application/jsonl'];

/**
 * one POST as the server saw it → { ok, reason, lines }: ok only for POST /log from the server's own origin, a JSON
 * content type, a body of 1 … LOG_MAX bytes, and every non-empty line parsing as JSON
 */
export function checkLogPost({ method, path, origin, serverOrigin, contentType, bytes, body }) {
  const no = reason => ({ ok: false, reason, lines: 0 });
  if (method !== 'POST') return no(`${method} is not allowed (POST to ${LOG_PATH} only)`);
  if (path !== LOG_PATH) return no(`POST to ${path} (only ${LOG_PATH})`);
  if (!origin || origin !== serverOrigin) return no(`origin ${origin || 'missing'} is not the page's own (${serverOrigin})`);
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!JSON_TYPES.includes(type)) return no(`content type ${type || 'missing'} (JSON lines only)`);
  if (!(bytes > 0)) return no('empty body');
  if (bytes > LOG_MAX) return no(`body ${bytes} bytes > ${LOG_MAX}`);
  let lines = 0;
  for (const line of String(body).split('\n')) {
    if (!line.trim()) continue;
    try { JSON.parse(line); lines++; } catch { return no(`line ${lines + 1} is not JSON`); }
  }
  return lines ? { ok: true, reason: null, lines } : no('no JSON lines');
}

/**
 * node http handler for POST /log (and any other non-GET/HEAD request): reads at most LOG_MAX + 1 bytes, checks it,
 * records { type: 'http', method, path, origin, bytes, status, ok, reason } with record(), and hands the accepted
 * text to onLines(text). Returns false for GET/HEAD so the caller serves files as usual.
 */
export function handleWrite(req, res, { serverOrigin, record, onLines }) {
  if (req.method === 'GET' || req.method === 'HEAD') return false;
  const path = new URL(req.url, 'http://x').pathname, origin = req.headers.origin || null;
  const chunks = []; let bytes = 0, over = false;
  req.on('data', d => { bytes += d.length; if (bytes <= LOG_MAX + 1) chunks.push(d); else over = true; });
  req.on('end', () => {
    const body = over ? '' : Buffer.concat(chunks).toString('utf8');
    const c = checkLogPost({ method: req.method, path, origin, serverOrigin, contentType: req.headers['content-type'], bytes, body });
    const status = c.ok ? 204 : bytes > LOG_MAX ? 413 : path !== LOG_PATH || req.method !== 'POST' ? 405 : origin !== serverOrigin ? 403 : 400;
    record({ type: 'http', method: req.method, path, origin, bytes, status, ok: c.ok, reason: c.reason, lines: c.lines });
    if (c.ok) onLines(body.endsWith('\n') ? body : body + '\n');
    res.writeHead(status, { 'content-type': 'text/plain' });
    res.end(c.ok ? '' : c.reason);
  });
  return true;
}

/**
 * the request log → the Q10 row { ok, value }. Entries:
 *   { type: 'http', method, ok, ... }   every request exp-run's server got (GET/HEAD are fine; writes must be ok)
 *   { type: 'request', origin }          the page asked another origin for something
 *   { type: 'ws', url }                  the page opened a WebSocket
 */
export function privacyRow(log) {
  const http = log.filter(e => e.type === 'http'), writes = http.filter(e => e.method !== 'GET' && e.method !== 'HEAD');
  const bad = writes.filter(e => !e.ok), other = log.filter(e => e.type === 'request'), ws = log.filter(e => e.type === 'ws');
  const posts = writes.filter(e => e.ok), bytes = posts.reduce((s, e) => s + e.bytes, 0);
  const why = [
    ...bad.slice(0, 3).map(e => `${e.method} ${e.path}: ${e.reason}`),
    ...(other.length ? [`${other.length} request(s) to ${[...new Set(other.map(e => e.origin))].slice(0, 3).join(', ')}`] : []),
    ...(ws.length ? [`${ws.length} WebSocket(s)`] : []),
  ];
  return {
    ok: !bad.length && !other.length && !ws.length,
    value: `${posts.length} POST /log (${bytes} bytes, max ${posts.length ? Math.max(...posts.map(e => e.bytes)) : 0}) · ${http.length - writes.length} GET/HEAD`
      + (why.length ? ` · ${why.join(' · ')}` : ' · no other origin, no WebSocket'),
  };
}
