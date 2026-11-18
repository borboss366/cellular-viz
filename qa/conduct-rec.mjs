// The conductor's recording of its own input (docs/SATURDAY_BRIEF.md box task 3): the node the clock listens to (the
// line input in guest mode, the playlist mix otherwise) goes as 16-bit stereo PCM to the box, next to the log:
// <sessions>/<session>.wav, always a valid WAV (the server rewrites the header after each chunk), and
// <sessions>/<session>.wav.json = { version, session, file, format, sampleRate, channels, startCtx }.
// startCtx is the AudioContext time of the file's first sample (an AudioWorklet's currentFrame / sampleRate), the clock
// the log's ctx fields use: log time t is sample round((t - startCtx) * sampleRate) of the file. The file starts when
// the input exists (Start audio; in guest mode 1.5 s later, when the clock opens its input) and stops with the page,
// as the log does; up to half a second at the very end can be lost. Never in the repo (R9): the sessions folder only.
//   page:   const rec = createRecorder({ ctx, post: (query, body) => fetch(`/rec/${id}?${query}`, { method: 'POST', body }) });
//           rec.start(node); rec.text(); rec.stop(beacon)
//   server: wavHeader(sampleRate, channels, dataBytes) (qa/conduct-serve.mjs, POST /rec/<session>?off=&sr=&ch=&start=)
export const CHUNK_FRAMES = 24000, CHANNELS = 2, BYTES_PER_FRAME = 2 * CHANNELS;

/** the AudioWorklet processor: interleaved stereo Int16 chunks of CHUNK_FRAMES frames, each with the context frame of
 *  its first sample; a mono input is copied to both channels, no input is silence (the timeline never skips) */
export const REC_WORKLET = `
class ConductRec extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(${CHUNK_FRAMES * CHANNELS}); this.n = 0; this.first = 0; }
  process(inputs) {
    const inp = inputs[0] || [], L = inp[0] || null, R = inp[1] || L, frames = L ? L.length : 128;
    const s = x => (x >= 1 ? 32767 : x <= -1 ? -32768 : Math.round(x * 32767));
    for (let i = 0; i < frames; i++) {
      if (this.n === 0) this.first = currentFrame + i;
      this.buf[this.n++] = L ? s(L[i]) : 0;
      this.buf[this.n++] = R ? s(R[i]) : 0;
      if (this.n >= this.buf.length) {
        this.port.postMessage({ frame: this.first, data: this.buf.buffer }, [this.buf.buffer]);
        this.buf = new Int16Array(${CHUNK_FRAMES * CHANNELS}); this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('conduct-rec', ConductRec);
`;

/** a 44-byte PCM WAV header (16-bit) for dataBytes of sample data */
export function wavHeader(sampleRate, channels, dataBytes) {
  const b = new ArrayBuffer(44), v = new DataView(b);
  const tag = (o, s) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true); tag(8, 'WAVE');
  tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * channels * 2, true); v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true);
  tag(36, 'data'); v.setUint32(40, dataBytes, true);
  return new Uint8Array(b);
}

/** the page side: chunks from the worklet, sent in order with their byte offset (a lost answer is resent safely: the
 *  server answers 409 with its size, and a chunk it already has is not sent again) */
export function createRecorder({ ctx, post, workletUrl = null, retryMs = 1000 }) {
  const st = { started: false, ready: false, startCtx: null, sampleRate: ctx.sampleRate, channels: CHANNELS, bytes: 0, queue: [], sending: false,
    gaps: 0, nextFrame: null, error: null, node: null, retry: 0 };
  async function send() {
    if (st.sending) return;
    st.sending = true;
    try {
      while (st.queue.length) {
        const c = st.queue[0];
        const q = `off=${st.bytes}` + (st.bytes === 0 ? `&sr=${st.sampleRate}&ch=${st.channels}&start=${st.startCtx}` : '');
        let r;
        try { r = await post(q, c); } catch (e) { st.error = String((e && e.message) || e); break; }
        if (r.status === 409) {
          const j = await r.json().catch(() => ({}));
          if (j.size === st.bytes + c.byteLength) { st.bytes = j.size; st.queue.shift(); continue; }   // it landed before
          st.error = `offset: the box has ${j.size}, this page ${st.bytes}`; break;
        }
        if (!r.ok) { st.error = `HTTP ${r.status}`; break; }
        st.bytes += c.byteLength; st.queue.shift(); st.error = null;
      }
    } finally { st.sending = false; }
    if (st.queue.length && !st.retry) st.retry = setTimeout(() => { st.retry = 0; send(); }, retryMs);
  }
  function chunk({ frame, data }) {
    if (st.startCtx === null) st.startCtx = frame / st.sampleRate;
    else if (st.nextFrame !== null && frame !== st.nextFrame) st.gaps++;
    st.nextFrame = frame + data.byteLength / BYTES_PER_FRAME;
    st.queue.push(data);
    return send();
  }
  async function start(node) {
    if (st.started || !node) return;
    st.started = true;
    try {
      const url = workletUrl || URL.createObjectURL(new Blob([REC_WORKLET], { type: 'text/javascript' }));
      await ctx.audioWorklet.addModule(url);
      const w = new AudioWorkletNode(ctx, 'conduct-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: CHANNELS, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
      w.port.onmessage = e => chunk(e.data);
      const sink = ctx.createGain(); sink.gain.value = 0; w.connect(sink); sink.connect(ctx.destination);   // pulled, silent
      node.connect(w);
      st.node = w; st.ready = true;
    } catch (e) { st.error = String((e && e.message) || e); }
  }
  /** at page hide: what is still queued goes in one beacon (only when nothing is in flight, so the order holds) */
  function stop(beacon) {
    if (!st.queue.length || st.sending || typeof beacon !== 'function') return false;
    const total = st.queue.reduce((s, c) => s + c.byteLength, 0), all = new Uint8Array(total);
    let o = 0;
    for (const c of st.queue) { all.set(new Uint8Array(c), o); o += c.byteLength; }
    const q = `off=${st.bytes}` + (st.bytes === 0 ? `&sr=${st.sampleRate}&ch=${st.channels}&start=${st.startCtx}` : '');
    return beacon(q, all);
  }
  const seconds = () => st.bytes / (BYTES_PER_FRAME * st.sampleRate);
  function text() {
    if (!st.started) return 'rec: waiting for the input';
    if (!st.ready) return st.error ? `rec: ERROR ${st.error}` : 'rec: starting';
    const mb = (st.bytes / 1048576).toFixed(1), s = Math.floor(seconds());
    return `rec: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} (${mb} MB)${st.queue.length > 2 ? `, ${st.queue.length} waiting` : ''}${st.error ? ` ERROR ${st.error}` : ''}`;
  }
  return { start, stop, chunk, send, text, seconds, get state() { return st; } };
}
