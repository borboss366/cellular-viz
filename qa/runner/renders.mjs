// Node-rendered tracks for the conductor page's box truths (#188 PR1b; brief Q5–Q8): metronomes with their exact grids
// and the Q7 playlist. They go to <QA_AUDIO_DIR>/renders/ (never next to the private tracks, never committed) and are
// served on exp-run's 127.0.0.1 only, at /qa-audio/renders/<file> (audio.mjs serveAudio).
//
//   metronome-<bpm>-<len>.wav            the clock's kick on every beat (truth.mjs synthMetronome, no marker lead):
//                                        48 kHz 16-bit stereo, the first click at 0, a bar accent every 4 beats
//   metronome-<bpm>-<len>.beatgrid.json  its grid, sidecar v2 like qa/beatgrid.mjs writes: each click's first sample
//                                        ≥ 0.05 (the true onset) in ms, pos 1–4, conf 1; source.from "render"
//   playlist-120-128.json                Q7: 120 BPM, a cut to 128 BPM, then an 8 s crossfade back to 120 BPM
//
// A playlist entry plays its track from position 0 for playS seconds. Its `in` is the transition into it:
//   { kind: "cut" }              starts when the previous entry's playS ends; the midpoint is that instant
//   { kind: "crossfade", s: 8 }  starts s seconds before the previous entry's playS ends, both decks overlap for s
//                                seconds, the midpoint is start + s/2 (R5: the outgoing grid applies until then)
// playlistTimeline() turns that into playlist-time starts and midpoints, for the page and the scorer alike.
// Every name starts with metronome- or playlist-, so render-names.json keeps them out of ref_beats.py.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthMetronome, toInt16Stereo } from './truth.mjs';
import { toSidecar } from '../beatgrid.mjs';
import { wavBytes, writeAtomic } from './audiocheck.mjs';

export const RENDERS_DIR = 'renders', SR = 48000, BPB = 4;
export const metronomeName = (bpm, len) => `metronome-${bpm}-${len}`;

/** a metronome at bpm for len seconds → { name, pcm (Int16 stereo), sr, grid (sidecar v2) } */
export function renderMetronome(bpm, len, sr = SR) {
  const { mono, refs } = synthMetronome(sr, bpm, len, { lead: false, bpb: BPB });
  const grid = toSidecar(refs.map((t, i) => ({ t, n: (i % BPB) + 1 })), { source: { from: 'render', bpm, len, sr } });
  return { name: metronomeName(bpm, len), pcm: toInt16Stereo(mono), sr, grid };
}

// Q7: 120 → cut → 128 → 8 s crossfade → 120; each track 60 s long, so every entry has audio to its end
export const PLAYLIST_120_128 = {
  version: 1, name: 'playlist-120-128',
  entries: [
    { track: metronomeName(120, 60), playS: 30 },
    { track: metronomeName(128, 60), playS: 30, in: { kind: 'cut' } },
    { track: metronomeName(120, 60), playS: 30, in: { kind: 'crossfade', s: 8 } },
  ],
};

/** a playlist → [{ track, startS, endS, in, midS }] on playlist time (midS: the transition's midpoint, null for the first) */
export function playlistTimeline(pl) {
  const out = [];
  for (const [i, e] of pl.entries.entries()) {
    let startS = 0, midS = null;
    if (i) {
      const prev = out[i - 1], tr = e.in || { kind: 'cut' };
      if (tr.kind === 'crossfade') { startS = prev.endS - tr.s; midS = startS + tr.s / 2; }
      else { startS = prev.endS; midS = startS; }
    }
    out.push({ track: e.track, startS: +startS.toFixed(6), endS: +(startS + e.playS).toFixed(6), in: e.in || null, midS: midS === null ? null : +midS.toFixed(6) });
  }
  return out;
}

/** the playlist file: the entries plus their timeline, so nobody re-derives the midpoints differently */
export const playlistFile = pl => ({ ...pl, timeline: playlistTimeline(pl) });

/**
 * make the renders the conductor truths need in <dir>/renders/, each only when missing → [made file names].
 * Written atomically, so a run that dies half-way leaves no short WAV behind.
 */
export function ensureRenders(dir, { metronomes = [[120, 60], [128, 60]], playlists = [PLAYLIST_120_128] } = {}) {
  const out = path.join(dir, RENDERS_DIR), made = [];
  fs.mkdirSync(out, { recursive: true });
  for (const [bpm, len] of metronomes) {
    const name = metronomeName(bpm, len), wav = path.join(out, name + '.wav'), grid = path.join(out, name + '.beatgrid.json');
    if (fs.existsSync(wav) && fs.existsSync(grid)) continue;
    const r = renderMetronome(bpm, len);
    writeAtomic(grid, JSON.stringify(r.grid) + '\n');
    writeAtomic(wav, wavBytes(r.pcm, r.sr, 2));
    made.push(name + '.wav', name + '.beatgrid.json');
  }
  for (const pl of playlists) {
    const f = path.join(out, pl.name + '.json');
    if (fs.existsSync(f)) continue;
    writeAtomic(f, JSON.stringify(playlistFile(pl), null, 1) + '\n');
    made.push(pl.name + '.json');
  }
  return made;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dir'), dir = i > 0 ? process.argv[i + 1] : null;
  if (!dir) { console.error('usage: node qa/runner/renders.mjs --dir <QA_AUDIO_DIR>'); process.exit(2); }
  const made = ensureRenders(dir);
  console.log(made.length ? `made ${made.join(', ')} in ${path.join(dir, RENDERS_DIR)}` : 'renders up to date');
}
