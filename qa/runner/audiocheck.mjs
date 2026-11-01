// Audio jobs (#141, experiment kind "audio"): the excerpt WAV that Chromium's fake capture plays, the offline
// analysis of that excerpt, and the gates' numbers from the page's per-frame log (__qa.audioIn.log).
//
// The offline analysis mirrors what the page measures: an AnalyserNode (Web Audio §1.8: the input down-mixed to
// mono, the last fftSize samples, a Blackman window, |X[k]| / N, smoothing over successive readings, dB) read once
// per frame, then audio-in's bandLevels (8 bands, dB −90 … −20 → 0 … 1). The constants are copied from
// experiments/audio-in.js, because the runner never runs a PR's code; audiocheck.test.mjs keeps them in step.
// Excerpts and logs hold no audio a person could listen to in git: the WAVs stay in QA_AUDIO_DIR, never committed
// or served beyond 127.0.0.1, and the reports keep only numbers.
import fs from 'node:fs';
import path from 'node:path';

export const BANDS = ['sub', 'kick', 'low', 'lowMid', 'mid', 'upperMid', 'presence', 'air'];
export const EDGES = [20, 60, 120, 250, 500, 2000, 4000, 8000, 16000];
export const DB_FLOOR = -90, DB_SPAN = 70;
export const VIAS = ['fake', 'loop'];
export const DEVICE = { fake: 'fake', loop: 'blackhole' };   // the ?device= substring each route's input matches

/** the excerpt's file name in QA_AUDIO_DIR: one file per (track, from, len) */
export const excerptName = a => `${a.track}.${a.from}-${a.len}.wav`;
export const excerptPath = (dir, a) => path.join(dir, excerptName(a));

// ---------- WAV (16-bit PCM) ----------
/** interleaved Int16 samples → a WAV file */
export function wavBytes(pcm, sampleRate, channels) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), h = Buffer.alloc(44);
  h.write('RIFF', 0, 'latin1'); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8, 'latin1');
  h.write('fmt ', 12, 'latin1'); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36, 'latin1'); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
/** a 16-bit PCM WAV → { sampleRate, channels, mono: Float32Array (the channels averaged, as an AnalyserNode down-mixes) } */
export function readWav(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('latin1', p, p + 4), size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(p + 8), channels: buf.readUInt16LE(p + 10), sampleRate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === 'data') data = buf.subarray(p + 8, Math.min(buf.length, p + 8 + size));
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('WAV without fmt or data');
  if (fmt.format !== 1 || fmt.bits !== 16) throw new Error(`WAV is format ${fmt.format}, ${fmt.bits} bit: 16-bit PCM only`);
  const ch = fmt.channels, n = Math.floor(data.length / 2 / ch), mono = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += data.readInt16LE((i * ch + c) * 2); mono[i] = s / ch / 32768; }
  return { sampleRate: fmt.sampleRate, channels: ch, mono };
}

// ---------- the AnalyserNode mirror ----------
function fft(re, im) {   // in place, radix 2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** audio-in's bandLevels: dB per bin → 8 levels 0..1 (the mean dB over each band's bins) */
export function bandLevels(db, sampleRate) {
  const n = db.length, hzPerBin = sampleRate / 2 / n, out = [];
  for (let i = 0; i < BANDS.length; i++) {
    const a = Math.max(1, Math.floor(EDGES[i] / hzPerBin)), b = Math.min(n - 1, Math.ceil(EDGES[i + 1] / hzPerBin));
    let s = 0, c = 0;
    for (let k = a; k <= b; k++) { const v = db[k]; s += Number.isFinite(v) ? v : DB_FLOOR; c++; }
    out.push(c ? Math.max(0, Math.min(1, ((s / c) - DB_FLOOR) / DB_SPAN)) : 0);
  }
  return out;
}

/**
 * the page's per-frame readings, offline: one reading every `hop` samples (a frame at 60 fps by default), each of
 * the last fftSize samples → { t: [s], rmsDb: [dBFS of the raw window], bands: [[8 levels]] }
 */
export function analyse(mono, sampleRate, { fftSize = 2048, smoothing = 0, hop = Math.round(sampleRate / 60) } = {}) {
  const N = fftSize, win = new Float64Array(N), smooth = new Float64Array(N / 2), re = new Float64Array(N), im = new Float64Array(N), db = new Float64Array(N / 2);
  for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N);
  const out = { t: [], rmsDb: [], bands: [] };
  for (let end = N; end <= mono.length; end += hop) {
    let s2 = 0;
    for (let i = 0; i < N; i++) { const x = mono[end - N + i]; s2 += x * x; re[i] = x * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) {
      smooth[k] = smoothing * smooth[k] + (1 - smoothing) * Math.hypot(re[k], im[k]) / N;
      db[k] = 20 * Math.log10(smooth[k]);
    }
    out.t.push(end / sampleRate); out.rmsDb.push(10 * Math.log10(s2 / N + 1e-20)); out.bands.push(bandLevels(db, sampleRate));
  }
  return out;
}

// ---------- the gates' numbers ----------
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const toDb = v => DB_FLOOR + DB_SPAN * v;
const r2 = x => (x === null || x === undefined || !Number.isFinite(x) ? null : +x.toFixed(2));
function pearson(x, y) {
  const n = x.length; if (n < 3) return null;
  let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx < 1e-12 || syy < 1e-12 ? null : sxy / Math.sqrt(sxx * syy);
}

/**
 * From the page's log and the offline analysis of the same excerpt:
 *   levelDuringDb    median RMS (dBFS) from 0.5 s after the input opened to 0.5 s before the excerpt ends
 *   levelAfterEndDb  the loudest frame from 0.5 s after the end (a noloop excerpt: should be silence)
 *   bandLiveDb / bandOfflineDb / bandDiffDb   per band, the medians over the excerpt in dB and their difference
 *   rowCorr / rowLagMs  per page row: Pearson of the row's glow with the band lane it follows, best lag within ±100 ms
 * info is __qa.audioIn (openedAt on the frame clock, device, banner); a.len the excerpt's length in seconds.
 */
export function audioMetrics(log, info, offline, a, via = 'fake') {
  const open = info && Number.isFinite(info.openedAt) ? info.openedAt : null;
  const out = { opened: open !== null, frames: 0, framesAfter: 0, device: info && info.device ? info.device.label || null : null,
    deviceOk: null, banner: info ? (info.banner ? 1 : 0) : null, levelDuringDb: null, levelAfterEndDb: null,
    bandLiveDb: [], bandOfflineDb: [], bandDiffDb: [], rowCorr: [], rowLagMs: [] };
  out.deviceOk = out.device ? (out.device.toLowerCase().includes(DEVICE[via]) ? 1 : 0) : 0;
  if (open === null || !Array.isArray(log)) return out;
  const end = open + a.len;
  const during = log.filter(e => e.t >= open + 0.5 && e.t <= end - 0.5), after = log.filter(e => e.t >= end + 0.5);
  out.frames = during.length; out.framesAfter = after.length;
  out.levelDuringDb = r2(median(during.map(e => e.rmsDb)));
  out.levelAfterEndDb = after.length ? r2(Math.max(...after.map(e => (Number.isFinite(e.rmsDb) ? e.rmsDb : -200)))) : null;
  for (let b = 0; b < BANDS.length; b++) {
    const live = median(during.map(e => (e.bands ? e.bands[b] : NaN))), off = offline ? median(offline.bands.map(x => x[b])) : null;
    out.bandLiveDb.push(live === null ? null : r2(toDb(live))); out.bandOfflineDb.push(off === null ? null : r2(toDb(off)));
    out.bandDiffDb.push(live === null || off === null ? null : r2(Math.abs(toDb(live) - toDb(off))));
  }
  const rowed = during.filter(e => Array.isArray(e.rows) && Array.isArray(e.lanes));
  if (rowed.length > 10) {
    const dts = rowed.slice(1).map((e, i) => e.t - rowed[i].t).filter(d => d > 0), dt = median(dts) || 1 / 60;
    const maxLag = Math.max(0, Math.round(0.1 / dt)), rows = rowed[0].rows.length;
    for (let k = 0; k < rows; k++) {
      const x = rowed.map(e => e.rows[k]), y = rowed.map(e => e.lanes[k]);
      let best = null, lag = 0;
      for (let L = -maxLag; L <= maxLag; L++) {   // L > 0: the glow follows its lane L frames later
        const xs = [], ys = [];
        for (let i = 0; i < x.length; i++) { const j = i - L; if (j >= 0 && j < y.length) { xs.push(x[i]); ys.push(y[j]); } }
        const c = pearson(xs, ys);
        if (c !== null && (best === null || c > best)) { best = c; lag = L; }
      }
      out.rowCorr.push(best === null ? null : +best.toFixed(4)); out.rowLagMs.push(best === null ? null : Math.round(lag * dt * 1000));
    }
  }
  return out;
}

/** the numbers gates can name (experiment.mjs METRICS 'audio.*') from audioMetrics' result */
export function audioGateMetrics(m) {
  const vals = xs => xs.filter(x => x !== null && Number.isFinite(x));
  const diffs = vals(m.bandDiffDb), corrs = vals(m.rowCorr);
  return { 'audio.deviceOk': m.deviceOk, 'audio.banner': m.banner, 'audio.levelDuringDb': m.levelDuringDb, 'audio.levelAfterEndDb': m.levelAfterEndDb,
    'audio.bandDiffDb.max': diffs.length ? Math.max(...diffs) : null, 'audio.rowCorr.min': corrs.length ? Math.min(...corrs) : null, 'audio.frames': m.frames };
}

/** write a file atomically (a temp name, then rename): a half-written excerpt is never picked up */
export function writeAtomic(file, bytes) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, bytes); fs.renameSync(tmp, file);
}
