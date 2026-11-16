// The Mac setup check (the user, 16 Nov 15:57: "a tool that I can run on the Mac to check whether everything is set
// up properly"). Pure classification for the browser half (experiments/setup-check.html) and its node tests; the
// shell half (tools/mac-check.sh) runs without node and does its own parsing. Every check returns
//   { item, status: 'PASS' | 'WARN' | 'FAIL', detail, fix, hint? }   (fix: one short step, ASD-STE100 style; '' on PASS;
//   hint: shown whatever the status)
// Text is plain ASCII (#205).

// the shared clock's BroadcastChannel (clock.js SHARED_CHANNEL; panic.js CHANNEL is the same channel)
export const CLOCK_CHANNEL = 'cellular-viz-clock';
export const LISTEN_MS = 3000;
// the controller's ports (midi-controller.js: DEVICE_PORT /LCXL3/, the DAW port by /DAW/) and the bridge's bus
export const LCXL3_RE = /LCXL3/, DAW_RE = /DAW/, IAC_BUS = 'IAC Driver Bus 1';
// shown with the IAC row whatever its status (VIZ research, 16 Nov: Resolume must listen on the bus too)
export const RESOLUME_IAC_HINT = 'In Resolume, open Preferences > MIDI and enable IAC Driver Bus 1.';
export const BLACKHOLE_RE = /BlackHole/i;

const row = (item, status, detail, fix = '') => ({ item, status, detail, fix: status === 'PASS' ? '' : fix });

/** isSecureContext: Web MIDI and the microphone need it (localhost through the tunnel is secure) */
export function classifySecure(secure, href = '') {
  return secure ? row('Secure context', 'PASS', 'the page is a secure context')
    : row('Secure context', 'FAIL', `the page is not a secure context (${href || 'unknown address'})`,
      'Open the tunnel and use http://localhost:8790/experiments/setup-check.html');
}

/** WebGL2 and the GPU renderer string; a software renderer is a WARN */
export function classifyWebgl(hasGl2, renderer) {
  if (!hasGl2) return row('WebGL2', 'FAIL', 'WebGL2 is not available', 'Turn on hardware acceleration in Chrome settings, System. Then restart Chrome');
  const r = renderer || 'renderer unknown';
  if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(r)) return row('WebGL2', 'WARN', `WebGL2 runs in software: ${r}`, 'Turn on hardware acceleration in Chrome settings, System. Then restart Chrome');
  return row('WebGL2', 'PASS', `WebGL2 on ${r}`);
}

/** Web MIDI port names -> two rows: the LCXL3 DAW ports (in and out) and the IAC bus for the bridge */
export function classifyMidi({ inputs = [], outputs = [], error = null } = {}) {
  if (error) {
    return [row('MIDI access', 'FAIL', `Web MIDI is not available: ${error}`, 'Use Chrome. Allow MIDI with system exclusive messages when Chrome asks')];
  }
  const dawIn = inputs.find(n => LCXL3_RE.test(n) && DAW_RE.test(n)), dawOut = outputs.find(n => LCXL3_RE.test(n) && DAW_RE.test(n));
  const lc = dawIn && dawOut ? row('LCXL3 DAW ports', 'PASS', `in "${dawIn}", out "${dawOut}"`)
    : row('LCXL3 DAW ports', 'FAIL', `LCXL3 DAW ${!dawIn && !dawOut ? 'input and output' : !dawIn ? 'input' : 'output'} not found`,
      'Connect the Launch Control XL 3 with a USB cable. Then push Run checks again');
  const iac = outputs.find(n => n.includes(IAC_BUS)) || inputs.find(n => n.includes(IAC_BUS));
  const bus = iac ? row('IAC Driver Bus 1', 'PASS', `"${iac}" is present`)
    : row('IAC Driver Bus 1', 'FAIL', 'IAC Driver Bus 1 not found',
      'Open Audio MIDI Setup. Open MIDI Studio. Double-click IAC Driver. Select Device is online');
  bus.hint = RESOLUME_IAC_HINT;
  return [lc, bus];
}

/** audio input labels (after getUserMedia, enumerateDevices) -> BlackHole present */
export function classifyAudioInputs(labels = [], { permission = true, error = null } = {}) {
  if (error || !permission) return row('Audio input', 'FAIL', `no microphone permission${error ? ': ' + error : ''}`, 'Allow the microphone for localhost in Chrome. Then push Run checks again');
  const named = labels.filter(Boolean);
  if (!named.length) return row('Audio input', 'WARN', 'no input names (no permission yet?)', 'Allow the microphone for localhost in Chrome. Then push Run checks again');
  const bh = named.find(l => BLACKHOLE_RE.test(l));
  return bh ? row('Audio input', 'PASS', `BlackHole is an input: "${bh}"`)
    : row('Audio input', 'FAIL', `BlackHole not found in ${named.length} inputs`, 'Install BlackHole 2ch from existential.audio. Then restart Chrome');
}

/** the messages heard on the clock channel in LISTEN_MS -> PASS when the conductor publishes (clock.js publish():
 *  { type: 'clock', v: 1, beats, bpm, ... } at most every 50 ms) */
export function classifyClock(msgs = []) {
  const clocks = msgs.filter(m => m && m.type === 'clock' && m.v === 1 && Number.isFinite(m.beats));
  if (!clocks.length) return row('Shared clock', 'FAIL', `no clock message in ${LISTEN_MS / 1000} s (${msgs.length} other messages)`,
    'Open the conductor page in this Chrome. Push Start audio and Play. Then push Run checks again');
  const last = clocks[clocks.length - 1];
  return row('Shared clock', 'PASS', `${clocks.length} clock messages, ${Number.isFinite(last.bpm) ? last.bpm.toFixed(1) : '-'} bpm, state ${last.state || '-'}`);
}

/** the panic channel (the same BroadcastChannel) opens; nothing is posted */
export function classifyPanic(opened, error = null) {
  return opened ? row('Panic channel', 'PASS', `channel "${CLOCK_CHANNEL}" opens`)
    : row('Panic channel', 'FAIL', `the channel does not open${error ? ': ' + error : ''}`, 'Use a current version of Chrome');
}

/** set.json -> the pages the server must serve: the conductor, the set page, set.json and each scene (in order, once) */
export function setUrls(set, base = '/experiments/') {
  const pages = ['clock-conductor.html', 'set.html', 'set.json'];
  for (const s of (set && Array.isArray(set.scenes) ? set.scenes : [])) if (s && typeof s.page === 'string' && s.page) pages.push(s.page);
  return [...new Set(pages)].map(p => base + p);
}

/** the rows -> counts and the exit status the shell uses (1 when any FAIL) */
export function summary(rows) {
  const n = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const r of rows) if (r.status in n) n[r.status]++;
  return { pass: n.PASS, warn: n.WARN, fail: n.FAIL, ok: n.FAIL === 0 };
}
