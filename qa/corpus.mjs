// The clock corpus (#188): qa/corpus.json (committed, keyed by short id, no file names: R9) and the box's private
// id → file map (option A), which never enters git.
//
//   <QA_AUDIO_DIR>/../corpus-map.json   (beside tracks/, e.g. /home/puggie/pi-durable-worker/data/qa-audio/corpus-map.json)
//   { "version": 1, "tracks": { "<corpus id>": "<file stem>", ... } }
//
// A stem is the track's file name without its extension, the same name its grid has (<stem>.beatgrid.json in
// tracks/). Ids the map lacks, or stems with no grid, are listed as unscored with the reason; never a failure.
// The user (or QA box with its file tool) writes the map; this module only reads it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORPUS_FILE = fileURLToPath(new URL('./corpus.json', import.meta.url));
export const BPM_TOLERANCE = 0.01;   // a gate track's fitted tempo must sit within 1 % of its corpus BPM

/** the committed rows */
export const loadCorpus = (file = CORPUS_FILE) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** the map beside the tracks folder → { id: stem } ({} when there is none yet) */
export function loadMap(tracksDir) {
  const f = path.join(path.dirname(path.resolve(tracksDir)), 'corpus-map.json');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { file: f, tracks: {}, missing: true }; }
  if (!raw || raw.version !== 1 || typeof raw.tracks !== 'object') throw new Error(`${f}: expected {"version": 1, "tracks": {id: stem}}`);
  return { file: f, tracks: raw.tracks, missing: false };
}

/** each corpus row → { id, stem, grid (the parsed sidecar) | null, reason } */
export function resolve(rows, map, tracksDir) {
  return rows.map(r => {
    const stem = map.tracks[r.id];
    if (!stem) return { id: r.id, stem: null, grid: null, reason: 'not in the map' };
    let grid = null;
    try { grid = JSON.parse(fs.readFileSync(path.join(tracksDir, stem + '.beatgrid.json'), 'utf8')); } catch {}
    return { id: r.id, stem, grid, reason: grid ? null : 'no grid' };
  });
}

/**
 * the hard tempo check: every gate row with a corpus BPM against its grid's fitted tempo (bpmFitCore when the
 * converter wrote one, else bpmFit; never medianBpm) → [{ id, bpm, fit, field, err, ok, skipped, reason }].
 * Rows without a BPM (the DJ set), not "gate", or whose grid has no fitted tempo yet are skipped with the reason.
 */
export function checkBpm(rows, resolved) {
  const byId = new Map(resolved.map(x => [x.id, x]));
  return rows.filter(r => r.status === 'gate').map(r => {
    const x = byId.get(r.id) || { grid: null, reason: 'not resolved' };
    if (r.bpm === null || r.bpm === undefined) return { id: r.id, skipped: true, reason: 'no corpus BPM' };
    if (!x.grid) return { id: r.id, skipped: true, reason: x.reason };
    const field = Number.isFinite(x.grid.bpmFitCore) ? 'bpmFitCore' : Number.isFinite(x.grid.bpmFit) ? 'bpmFit' : null;
    if (!field) return { id: r.id, skipped: true, reason: 'grid has no fitted tempo yet' };
    const fit = x.grid[field], err = Math.abs(fit - r.bpm) / r.bpm;
    return { id: r.id, bpm: r.bpm, fit, field, err: +err.toFixed(5), ok: err <= BPM_TOLERANCE, skipped: false };
  });
}
