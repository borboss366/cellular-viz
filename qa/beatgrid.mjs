#!/usr/bin/env node
// Beat This! grids → the clock's sidecar v2 (#173; #95 comment 6564285787). Beat This! (qa/ref-beats.sh) is the
// gridder: no other beat tracker is ported. Its <track>.ref.beats (time<TAB>beat-in-bar, 1 = downbeat) becomes
// <track>.beatgrid.json, which experiments/clock.js reads for `file:` sources, so the truth (b) reference and the
// rehearsal grid are one file.
//
//   { version: 2, beats: [{ ms, pos, conf }], edits: [...], source: {...}, orphaned: [...] }
//
// - ms: the Beat This! time in milliseconds (3 decimals); pos: its beat-in-bar, as given (irregular bars kept).
// - conf: 1.0 on every beat. Beat This! gives no per-beat confidence (Audio2Beats returns beat and downbeat times
//   only), and none is invented (VIZ research ruling, 1 Nov).
// - edits: hand fixes from the grid editor ({ kind, atMs, value?, toMs?, by }). They live in the sidecar, survive
//   every re-conversion and are replayed on top of the fresh Beat This! beats. An edit anchors to the nearest beat
//   within ±60 ms of its atMs; if none is there any more, it is kept, not applied, and listed in `orphaned`. User
//   edits are never dropped.
//   move   { atMs, value: newMs }          the beat moves to value (order kept: it may not pass a neighbour)
//   setOne { atMs }                        this beat is a "1"; pos counts on in 4s (bpb) up to the next setOne
//   nudge  { atMs, value: ms, toMs? }      beats from atMs (to toMs, else to the end) shift by value ms
//   x2 / half / tap                        kept for the grid editor; the converter does not apply them
//
// CLI:  node qa/beatgrid.mjs <track>.ref.beats [--out <track>.beatgrid.json]
//       node qa/beatgrid.mjs --dir <folder>     every *.ref.beats whose sidecar is missing or older
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANCHOR_MS = 60;
const round3 = x => Math.round(x * 1000) / 1000;

/** Beat This! TSV text → [{ t (s), n (beat-in-bar or NaN) }], sorted, junk lines skipped */
export function parseRefBeats(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const [a, b] = s.split(/\s+/), t = Number(a), n = Number(b);
    if (Number.isFinite(t)) out.push({ t, n: Number.isInteger(n) && n >= 1 ? n : NaN });
  }
  out.sort((x, y) => x.t - y.t);
  return out.filter((x, i) => i === 0 || x.t > out[i - 1].t);
}

/** the index of the beat nearest ms, if within ANCHOR_MS, else -1 */
function anchor(beats, ms) {
  let best = -1, d = Infinity;
  for (let i = 0; i < beats.length; i++) { const e = Math.abs(beats[i].ms - ms); if (e < d) { d = e; best = i; } }
  return d <= ANCHOR_MS ? best : -1;
}

/** replay edits on beats (in place, in the order given) → the edits that found no beat */
export function replayEdits(beats, edits, bpb = 4) {
  const orphaned = [];
  for (const e of edits || []) {
    if (!e || typeof e !== 'object') continue;
    if (!['move', 'setOne', 'nudge'].includes(e.kind)) continue;   // x2, half, tap: the grid editor's
    const i = anchor(beats, Number(e.atMs));
    if (i < 0) { orphaned.push(e); continue; }
    if (e.kind === 'move') {
      const lo = i ? beats[i - 1].ms : -Infinity, hi = i < beats.length - 1 ? beats[i + 1].ms : Infinity, v = Number(e.value);
      if (Number.isFinite(v) && v > lo && v < hi) beats[i].ms = round3(v); else orphaned.push(e);
    } else if (e.kind === 'setOne') {
      let j = i, k = 0;
      do { beats[j].pos = (k % bpb) + 1; j++; k++; } while (j < beats.length && !beats[j].one);
      beats[i].one = true;
    } else if (e.kind === 'nudge') {
      const v = Number(e.value), to = e.toMs == null ? Infinity : Number(e.toMs);
      if (!Number.isFinite(v)) { orphaned.push(e); continue; }
      for (let j = i; j < beats.length && beats[j].ms <= to; j++) beats[j].ms = round3(beats[j].ms + v);
    }
  }
  for (const b of beats) delete b.one;
  return orphaned;
}

/** parsed ref beats (+ the edits to keep) → sidecar v2 */
export function toSidecar(ref, { edits = [], source = {} } = {}) {
  const beats = ref.map(r => ({ ms: round3(r.t * 1000), pos: Number.isInteger(r.n) ? r.n : undefined, conf: 1 }));
  for (let i = 0; i < beats.length; i++) if (beats[i].pos === undefined) delete beats[i].pos;   // clock.js counts on
  const orphaned = replayEdits(beats, edits);
  for (let i = 1; i < beats.length; i++) if (!(beats[i].ms > beats[i - 1].ms)) throw new Error(`beat ${i} not after beat ${i - 1} after the edits`);
  return { version: 2, beats, edits: [...edits], orphaned, source: { from: 'beat-this', ...source } };
}

/** convert one .ref.beats file, keeping the edits already in its sidecar; written atomically. Returns the sidecar. */
export function convertFile(refPath, outPath) {
  const out = outPath || refPath.replace(/\.ref\.beats$/, '') + '.beatgrid.json';
  let edits = [];
  try { const old = JSON.parse(fs.readFileSync(out, 'utf8')); if (Array.isArray(old.edits)) edits = old.edits; } catch {}
  const st = fs.statSync(refPath);
  const side = toSidecar(parseRefBeats(fs.readFileSync(refPath, 'utf8')),
    { edits, source: { ref: path.basename(refPath), refMtime: st.mtime.toISOString() } });
  const tmp = `${out}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(side) + '\n');
  fs.renameSync(tmp, out);
  return side;
}

/** every <name>.ref.beats in dir whose <name>.beatgrid.json is missing or older → converted. Returns [{ name, beats, orphaned }]. */
export function ensureGrids(dir) {
  const done = [];
  let names = [];
  try { names = fs.readdirSync(dir).filter(f => f.endsWith('.ref.beats')); } catch { return done; }
  for (const f of names) {
    const ref = path.join(dir, f), out = path.join(dir, f.replace(/\.ref\.beats$/, '.beatgrid.json'));
    let stale = true;
    try { stale = fs.statSync(out).mtimeMs < fs.statSync(ref).mtimeMs; } catch {}
    if (!stale) continue;
    try { const s = convertFile(ref, out); done.push({ name: f.replace(/\.ref\.beats$/, ''), beats: s.beats.length, orphaned: s.orphaned.length }); }
    catch (e) { done.push({ name: f, error: String(e.message || e) }); }
  }
  return done;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), at = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (at('--dir')) {
    for (const r of ensureGrids(at('--dir'))) console.log(r.error ? `${r.name}: ${r.error}` : `${r.name}: ${r.beats} beats${r.orphaned ? `, ${r.orphaned} orphaned edits` : ''}`);
  } else if (a[0] && !a[0].startsWith('--')) {
    const s = convertFile(a[0], at('--out'));
    console.log(`${s.beats.length} beats, ${s.edits.length} edits (${s.orphaned.length} orphaned)`);
  } else {
    console.error('usage: node qa/beatgrid.mjs <track>.ref.beats [--out file] | --dir <folder>');
    process.exit(2);
  }
}
