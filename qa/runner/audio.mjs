// The real music tracks for the clock's truth (b) (#95): copyrighted, so they live only in a private folder on the
// QA box (QA_AUDIO_DIR) and never in git, a run folder, a report or anything served beyond 127.0.0.1.
// Reports keep a track's file name and sha256, never the audio.
//
// Fixed names, each as .flac, .wav, .m4a or .mp3 (lossless preferred; lossy ones arrive as they are, never re-encoded):
//   darude-sandstorm · prodigy-voodoo-people · massive-attack-teardrop · james-brown
// For a lossy file the encoder delay is read from the file (MP3 LAME tag; M4A iTunSMPB or the edit list), because a
// decoder offset of ~25–50 ms matters against the 40 ms gates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const AUDIO_DIR_DEFAULT = '/home/puggie/pi-durable-worker/data/qa-audio/tracks';
export const TRACKS = ['darude-sandstorm', 'prodigy-voodoo-people', 'massive-attack-teardrop', 'james-brown'];
export const EXTS = ['.flac', '.wav', '.m4a', '.mp3'];   // the order a name is looked up in
export const TYPES = { '.flac': 'audio/flac', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };
const LOSSY = new Set(['.m4a', '.mp3']);

/** the folder: an explicit path, else $QA_AUDIO_DIR, else the default */
export function audioDir(explicit) {
  const e = process.env.QA_AUDIO_DIR;
  return path.resolve(explicit || (e !== undefined && e !== '' ? e : AUDIO_DIR_DEFAULT));
}

/** a fixed track name (with or without one of EXTS) → its file in dir, or null. Anything else (paths, other names) → null. */
export function findTrack(name, dir) {
  if (typeof name !== 'string') return null;
  const ext = EXTS.find(x => name.endsWith(x)), base = ext ? name.slice(0, -ext.length) : name;
  if (!TRACKS.includes(base)) return null;
  for (const x of ext ? [ext] : EXTS) {
    const p = path.join(dir, base + x);
    try { if (fs.statSync(p).isFile()) return { name: base, file: base + x, ext: x, path: p }; } catch {}
  }
  return null;
}

/** sha256 of a file, streamed */
export function sha256(p) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(p).on('data', d => h.update(d)).on('error', reject).on('end', () => resolve(h.digest('hex')));
  });
}

/** MP3: encoder delay and padding (samples) from the LAME tag in the first frame, or null */
export function lameDelay(buf) {
  const i = buf.indexOf('LAME');
  if (i < 0 || i + 24 > buf.length) return null;
  // after "LAME": version (9 bytes), revision/VBR, lowpass, peak (4), track gain (2), album gain (2), flags, bitrate,
  // then 3 bytes: delay (12 bits) and padding (12 bits)
  const o = i + 21, delay = (buf[o] << 4) | (buf[o + 1] >> 4), padding = ((buf[o + 1] & 0x0f) << 8) | buf[o + 2];
  return delay <= 4095 ? { delay, padding, from: 'LAME tag' } : null;
}

/** M4A: priming (encoder delay) and padding (samples) from iTunSMPB, else the edit list's media time, or null */
export function m4aDelay(buf) {
  const i = buf.indexOf('iTunSMPB');
  if (i >= 0) {
    const m = buf.slice(i, i + 200).toString('latin1').match(/ ([0-9A-Fa-f]{8}) ([0-9A-Fa-f]{8}) ([0-9A-Fa-f]{8}) ([0-9A-Fa-f]{16})/);
    if (m) return { delay: parseInt(m[2], 16), padding: parseInt(m[3], 16), from: 'iTunSMPB' };
  }
  const e = buf.indexOf('elst');
  if (e >= 4 && e + 28 <= buf.length) {
    const v = buf[e + 4], n = buf.readUInt32BE(e + 8);
    if (n >= 1) {
      const mt = v === 1 ? Number(buf.readBigInt64BE(e + 20)) : buf.readInt32BE(e + 16);
      if (mt >= 0) return { delay: mt, padding: null, from: 'edit list (media time, in the track timescale)' };
    }
  }
  return null;
}

/** sample rate from the header, or null: FLAC STREAMINFO, WAV fmt */
export function sampleRate(buf, ext) {
  if (ext === '.flac' && buf.length >= 21 && buf.toString('latin1', 0, 4) === 'fLaC') return (buf[18] << 12) | (buf[19] << 4) | (buf[20] >> 4);
  if (ext === '.wav' && buf.length >= 28 && buf.toString('latin1', 0, 4) === 'RIFF') {
    const f = buf.indexOf('fmt ');
    if (f >= 0 && f + 16 <= buf.length) return buf.readUInt32LE(f + 12);
  }
  return null;
}

function headTail(p, n = 1 << 20) {   // the first and last n bytes (an M4A's moov can sit at the end)
  const fd = fs.openSync(p, 'r');
  try {
    const size = fs.fstatSync(fd).size, a = Buffer.alloc(Math.min(n, size));
    fs.readSync(fd, a, 0, a.length, 0);
    if (size <= n) return a;
    const b = Buffer.alloc(Math.min(n, size - n));
    fs.readSync(fd, b, 0, b.length, size - b.length);
    return Buffer.concat([a, b]);
  } finally { fs.closeSync(fd); }
}

/** one track's report entry: {name, file, sha256, bytes, format, lossy, sampleRate, encoderDelay} or {name, missing: true} */
export async function trackInfo(name, dir) {
  const t = findTrack(name, dir);
  if (!t) return { name, missing: true };
  const buf = headTail(t.path), lossy = LOSSY.has(t.ext);
  return { name, file: t.file, sha256: await sha256(t.path), bytes: fs.statSync(t.path).size, format: t.ext.slice(1), lossy,
    sampleRate: sampleRate(buf, t.ext), encoderDelay: lossy ? (t.ext === '.mp3' ? lameDelay(buf) : m4aDelay(buf)) : null };
}

/** which tracks are present (names only, no hashing): {present: [..], missing: [..]} */
export function scanTracks(dir) {
  const present = TRACKS.filter(n => findTrack(n, dir));
  return { dir, present, missing: TRACKS.filter(n => !present.includes(n)) };
}

/** the tracks an experiment uses: params.track in the experiment or a variant, and gates[].track */
export function tracksUsed(exp) {
  const out = new Set();
  const add = v => { if (typeof v === 'string' && TRACKS.includes(v)) out.add(v); };
  add(exp.params?.track);
  add(exp.audio?.track);   // kind "audio" (#141): the excerpt's track
  for (const v of exp.variants || []) add(v.params?.track);
  for (const vals of Object.values(exp.sweep || {})) if (Array.isArray(vals)) vals.forEach(add);
  for (const g of exp.gates || []) add(g.track);
  return [...out];
}

/** a one-line summary for logs and reports: names and short hashes, never the audio */
export function describe(infos) {
  return infos.map(i => i.missing ? `${i.name}: missing` : `${i.file} sha256 ${i.sha256.slice(0, 12)}${i.sampleRate ? ` ${i.sampleRate} Hz` : ''}`
    + (i.lossy ? ` · encoder delay ${i.encoderDelay ? `${i.encoderDelay.delay} samples (${i.encoderDelay.from})` : 'unknown'}` : '')).join(' · ');
}

/**
 * HTTP handler for /qa-audio/<name>[.<ext>]: only the fixed names, only from dir, with Range support (an <audio>
 * element seeks with it). Returns false when the URL isn't under /qa-audio/, so the caller serves it as usual.
 * The caller's server must listen on 127.0.0.1 only.
 */
export function serveAudio(req, res, dir) {
  const u = new URL(req.url, 'http://x');
  if (!u.pathname.startsWith('/qa-audio/')) return false;
  const t = findTrack(decodeURIComponent(u.pathname.slice('/qa-audio/'.length)), dir);
  if (!t) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('track missing'); return true; }
  const size = fs.statSync(t.path).size, type = TYPES[t.ext], m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const head = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  if (m && (m[1] || m[2])) {
    let a = m[1] ? +m[1] : size - +m[2], b = m[1] && m[2] ? +m[2] : size - 1;
    a = Math.max(0, a); b = Math.min(size - 1, b);
    if (a > b) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return true; }
    res.writeHead(206, { ...head, 'content-range': `bytes ${a}-${b}/${size}`, 'content-length': b - a + 1 });
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(t.path, { start: a, end: b }).pipe(res);
    return true;
  }
  res.writeHead(200, { ...head, 'content-length': size });
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(t.path).pipe(res);
  return true;
}
