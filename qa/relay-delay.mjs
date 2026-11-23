#!/usr/bin/env node
// The relay's delay (docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md task 6; the steps: docs/BEAT_RELAY_DELAY.md). Two clients on
// one relay, on one clock: a sender posts { type: 'delay-probe', v: 1, i, t } at a fixed rate and a receiver takes
// now - t for each one, so the delay is sender -> relay -> receiver as a page sees it (no clock offset in it). Report:
// p50 / p90 / p99 / max and the lost ones. The probes are a type no page uses; they go only to the relay they are sent to.
//
//   node qa/relay-delay.mjs --self [--n 600] [--rate 20] [--bytes 300] [--json out.json]
//        one machine: an in-process relay and the two clients (the node tests run a short one and print it)
//   node qa/relay-delay.mjs --url ws://host:port/relay?v=1 [--n ...]
//        a running relay (a test relay below, or conduct-serve's after its restart)
//   node qa/relay-delay.mjs --serve (--socket <path> | --port 8791 [--host 127.0.0.1])
//        a separate TEST relay (not conduct-serve: nothing to restart) that also serves the browser measure page
//        (experiments/relay-delay.html) at /; a browser through the tunnel measures with it (the Mac part)
// R9: the probes carry numbers only; nothing is logged per message.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createRelay, connect, RELAY_PATH, RELAY_VERSION } from './beat-relay.mjs';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE = path.join(REPO, 'experiments', 'relay-delay.html');
export const PROBE = 'delay-probe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2 = x => Math.round(x * 100) / 100;

/** nearest-rank percentile of sorted numbers (p 0..100); null for none */
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const k = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1));
  return sorted[k];
}
/** delays (ms) of the probes that arrived, and how many were sent -> the report's numbers */
export function summary(delays, sent) {
  const d = delays.filter(Number.isFinite).slice().sort((a, b) => a - b);
  const pick = p => (d.length ? r2(percentile(d, p)) : null);
  return { sent, got: d.length, lost: Math.max(0, sent - d.length), p50: pick(50), p90: pick(90), p99: pick(99),
    max: d.length ? r2(d[d.length - 1]) : null, mean: d.length ? r2(d.reduce((s, x) => s + x, 0) / d.length) : null };
}

/** measure a relay at url: n probes at rate a second, each about `bytes` long; resolves with the summary */
export async function measure(url, { n = 600, rate = 20, bytes = 300, settleMs = 1500, now = () => performance.now() } = {}) {
  const tx = await connect(url), rx = await connect(url);
  try {
    await tx.wait(m => m.type === 'hello'); await rx.wait(m => m.type === 'hello');
    const delays = new Array(n).fill(NaN);
    rx.on('msg', m => { if (m && m.type === PROBE && Number.isInteger(m.i) && m.i >= 0 && m.i < n && Number.isNaN(delays[m.i])) delays[m.i] = now() - m.t; });
    const pad = 'x'.repeat(Math.max(0, bytes - 60));
    const gap = 1000 / Math.max(1, rate), t0 = now();
    for (let i = 0; i < n; i++) {
      const due = t0 + i * gap, wait = due - now();
      if (wait > 0) await sleep(wait);
      tx.send({ type: PROBE, v: RELAY_VERSION, i, t: now(), pad });
    }
    const end = now() + settleMs;
    while (now() < end && delays.some(Number.isNaN)) await sleep(20);
    return { url, n, rate, bytes, ...summary(delays.filter(x => !Number.isNaN(x)), n) };
  } finally { tx.peer.destroy(); rx.peer.destroy(); }
}

/** a test relay with the measure page at / (and /relay-delay.html); listen with .listen(port, host) or on a socket */
export function testServer({ relayOpts = {} } = {}) {
  const relay = createRelay(relayOpts);
  const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://local').pathname;
    if (req.method === 'GET' && (p === '/' || p === '/relay-delay.html')) {
      let html;
      try { html = fs.readFileSync(PAGE); } catch (e) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('no page'); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(html); return;
    }
    if (req.method === 'GET' && p === '/api/relay') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(relay.stats())); return; }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  });
  relay.attach(server);
  return { server, relay };
}

function listenSocket(server, sock) {
  try { if (!fs.lstatSync(sock).isDirectory()) fs.unlinkSync(sock); } catch { /* none there */ }
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(sock, () => { server.off('error', reject); fs.chmodSync(sock, 0o600); resolve(sock); });
  });
}

async function main(argv) {
  const args = argv.slice(2), has = k => args.includes(k), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const n = +opt('--n', 600), rate = +opt('--rate', 20), bytes = +opt('--bytes', 300), out = opt('--json');
  if (has('--serve')) {
    const { server, relay } = testServer();
    const sock = opt('--socket');
    if (sock) await listenSocket(server, sock);
    else await new Promise(r => server.listen(+opt('--port', 8791), opt('--host', '127.0.0.1'), r));
    console.log(`relay-delay: test relay on ${sock || `http://${opt('--host', '127.0.0.1')}:${server.address().port}/`} (measure page at /, relay at ${RELAY_PATH}?v=${RELAY_VERSION})`);
    for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { relay.close(); server.close(() => process.exit(0)); });
    return;
  }
  let url = opt('--url'), local = null;
  if (has('--self') || !url) {
    local = testServer();
    await new Promise(r => local.server.listen(0, '127.0.0.1', r));
    url = `ws://127.0.0.1:${local.server.address().port}${RELAY_PATH}?v=${RELAY_VERSION}`;
  }
  try {
    const res = { at: new Date().toISOString(), where: local ? 'one machine (in-process relay)' : url, ...(await measure(url, { n, rate, bytes })) };
    console.log(`relay delay ${res.where}: ${res.got}/${res.sent} probes at ${rate}/s, p50 ${res.p50} ms, p90 ${res.p90} ms, p99 ${res.p99} ms, max ${res.max} ms, lost ${res.lost}`);
    if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
  } finally {
    if (local) { local.relay.close(); local.server.close(); }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).catch(e => { console.error(`relay-delay: ${e.message}`); process.exit(1); });
}
