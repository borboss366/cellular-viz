// Scenes ready for a projector (the apartment MVP, Task 2; the user 14 Nov 14:55): ?in=<label substring> on audio-in
// and the line clock, ?capture=1's layout, panic over the shared clock's channel (conductor -> every scene), and
// set.html's URLs from set.json. No browser here: the DOM side runs in clock-shared-smoke.test.mjs on the box.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');
const AudioIn = require('../../../experiments/audio-in.js');
const Panic = require('../../../experiments/panic.js');
const SetLib = require('../../../experiments/set.js');
const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../experiments');
const C = await import('../../../experiments/conductor.mjs');

function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = extra => ({ connect() {}, disconnect() {}, ...extra });
  return {
    currentTime: 0, sampleRate: 48000, outputLatency: 0, baseLatency: 0, destination: {}, resume() {},
    createGain: () => node({ gain: param() }),
    createOscillator: () => node({ frequency: param(), start() {}, stop() {} }),
    createBufferSource: () => node({ buffer: null, loop: false, start() {}, stop() {} }),
    createBiquadFilter: () => node({ type: '', frequency: { value: 0 } }),
    createAnalyser: () => node({ fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0, getFloatTimeDomainData(a) { a.fill(0); }, getFloatFrequencyData(a) { a.fill(-120); } }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createMediaStreamSource: s => node({ stream: s }),
  };
}
const DEVICES = [
  { kind: 'audioinput', deviceId: 'default', label: 'Default - MacBook Pro Microphone' },
  { kind: 'audioinput', deviceId: 'mbp', label: 'MacBook Pro Microphone (Built-in)' },
  { kind: 'audiooutput', deviceId: 'spk', label: 'BlackHole 2ch (Virtual)' },
  { kind: 'audioinput', deviceId: 'bh2', label: 'BlackHole 2ch (Virtual)' },
];
const tick = () => new Promise(r => setImmediate(r));

// ---------- ?in= ----------
test('?in=: Clock.pickInput matches an audioinput label by substring, case-insensitive, never an output; nothing for no match', () => {
  assert.equal(Clock.pickInput(DEVICES, 'blackhole').deviceId, 'bh2');
  assert.equal(Clock.pickInput(DEVICES, 'BlackHole').deviceId, 'bh2');
  assert.equal(Clock.pickInput(DEVICES, 'built-in').deviceId, 'mbp');
  assert.equal(Clock.pickInput(DEVICES, 'loopback'), null);
  assert.equal(Clock.pickInput(DEVICES, ''), null);
  assert.equal(Clock.pickInput([DEVICES[2]], 'blackhole'), null, 'the output with the same label is not an input');
});

test('?in= on audio-in (?audio=line): picks the input by label with no chooser; ?in= wins over ?device=', async () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { search: '?audio=line&in=BlackHole&device=built-in' }, configurable: true, writable: true });
  try {
    const ctx = fakeContext(), asked = [];
    const clock = Clock.create({ audioContext: () => ctx, timers: false, keys: false });
    const audio = AudioIn.create({ clock, source: 'line', storage: null, enumerateDevices: async () => DEVICES,
      getUserMedia: async c => { asked.push(c); return { getTracks: () => [] }; } }).start();
    clock.start(); ctx.currentTime += 0.02; clock.schedule(); audio.frameStart(16); audio.read();
    await tick(); await tick();
    assert.ok(asked.length >= 1, 'getUserMedia was called');
    assert.deepEqual(asked[asked.length - 1].audio.deviceId, { exact: 'bh2' });
    assert.equal(audio.device.label, 'BlackHole 2ch (Virtual)');
    assert.equal(audio.warning, null);
  } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
  }
});

function lineClock(extra) {
  const ctx = fakeContext(), asked = [];
  const tracker = { jumps: [], push() {}, snapshot: () => ({ state: 'acquire', confidence: 0 }) };
  const clock = Clock.create({ source: 'line', audioContext: () => ctx, timers: false, keys: false, tracker, lineFeed: true,
    getUserMedia: async c => { asked.push(c); return { getTracks: () => [{ stop() {} }] }; }, ...extra });
  clock.start();
  return { clock, asked };
}
test('?in= on the line clock (its own input): that input by exact deviceId, no browser processing; trackerState.device says so', async () => {
  const { clock, asked } = lineClock({ inputLabel: 'blackhole', enumerateDevices: async () => DEVICES });
  await clock.openLineInput();
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].audio.deviceId, { exact: 'bh2' });
  assert.equal(asked[0].audio.echoCancellation, false); assert.equal(asked[0].audio.noiseSuppression, false); assert.equal(asked[0].audio.autoGainControl, false);
  assert.deepEqual(clock.trackerState.device, { wanted: 'blackhole', label: 'BlackHole 2ch (Virtual)', deviceId: 'bh2', matched: true });
});

test('?in= with no match falls back to the default input (as without ?in=), matched false; labels hidden: one plain ask first', async () => {
  const a = lineClock({ inputLabel: 'loopback', enumerateDevices: async () => DEVICES });
  await a.clock.openLineInput();
  assert.equal(a.asked.length, 1);
  assert.equal(a.asked[0].audio.deviceId, undefined, 'the browser\'s default input');
  assert.equal(a.clock.trackerState.device.matched, false);
  // with hidden labels the first ask has no deviceId, the second the match (the stub's labels appear after any ask)
  const c = lineClock({ inputLabel: 'blackhole', enumerateDevices: async () => DEVICES.map(d => ({ ...d, label: c && c.asked.length ? d.label : '' })) });
  await c.clock.openLineInput();
  assert.equal(c.asked.length, 2);
  assert.equal(c.asked[0].audio.deviceId, undefined);
  assert.deepEqual(c.asked[1].audio.deviceId, { exact: 'bh2' });
  const none = lineClock({ inputLabel: null, enumerateDevices: async () => { throw new Error('not asked without ?in='); } });
  await none.clock.openLineInput();
  assert.equal(none.asked.length, 1); assert.equal(none.asked[0].audio.deviceId, undefined);
  assert.deepEqual(none.clock.trackerState.device, { wanted: null, label: null, deviceId: null, matched: false });
});

// ---------- ?capture=1 ----------
test('?capture=1 layout: a 1920x1080 stage scaled to fit any window, centred (letterbox / pillarbox)', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const l1 = Panic.captureLayout(1920, 1080);
  assert.deepEqual([l1.w, l1.h, l1.scale, l1.left, l1.top], [1920, 1080, 1, 0, 0]);
  const l2 = Panic.captureLayout(1280, 720);
  assert.ok(near(l2.scale, 2 / 3) && near(l2.left, 0) && near(l2.top, 0));
  const l3 = Panic.captureLayout(1000, 800);   // taller: bars top and bottom
  assert.ok(near(l3.scale, 1000 / 1920) && near(l3.left, 0) && near(l3.top, (800 - 1080 * 1000 / 1920) / 2));
  const l4 = Panic.captureLayout(2560, 1080);  // wider: bars left and right
  assert.ok(near(l4.scale, 1) && near(l4.left, 320) && near(l4.top, 0));
  const l5 = Panic.captureLayout(3840, 2160);
  assert.ok(near(l5.scale, 2), 'a 4K window shows the 1920x1080 stage scaled up');
  assert.deepEqual([Panic.CAPTURE_W, Panic.CAPTURE_H], [1920, 1080]);
});

test('?capture=1 in panic.js: hides all but the scene canvas, no cursor, black, dpr 1, presses Play; the shared badge stays off', () => {
  const src = fs.readFileSync(path.join(EX, 'panic.js'), 'utf8');
  assert.match(src, /get\('capture'\) === '1'/);
  assert.match(src, /cursor: none !important/);
  assert.match(src, /background: #000 !important/);
  assert.match(src, /defineProperty\(window, 'devicePixelRatio', \{ get: \(\) => 1/);
  assert.match(src, /if \(c !== canvas && !\(c\.tagName === 'CANVAS' && c\.dataset\.capture === 'keep'\)/, 'inside the stage only the scene canvas stays (label canvases go)');
  assert.match(src, /new MutationObserver\(hideOutside\)/, 'banners added later are hidden too');
  assert.match(src, /play\.click\(\)/);
  const clock = fs.readFileSync(path.join(EX, 'clock.js'), 'utf8');
  assert.match(clock, /queryParam\('capture'\) !== '1'/, 'no shared badge under ?capture=1');
});

// ---------- panic over the channel ----------
test('panic over the shared clock channel: the conductor\'s publisher sends it, every scene maps it to a mode it sets', () => {
  assert.equal(Panic.CHANNEL, Clock.SHARED_CHANNEL, 'one channel for the clock and the panic');
  assert.equal(Panic.panicMode({ type: 'panic', mode: 'blackout' }), 'blackout');
  assert.equal(Panic.panicMode({ type: 'panic', mode: 'calm' }), 'calm');
  assert.equal(Panic.panicMode({ type: 'panic', mode: 'clear' }), 'off');
  for (const m of [{ type: 'panic', mode: 'strobe' }, { type: 'clock', mode: 'blackout' }, null, 'blackout']) assert.equal(Panic.panicMode(m), null);
  const sent = [], clock = Clock.create({ audioContext: () => fakeContext(), timers: false, keys: false });
  const pub = Clock.publish(clock, { timers: false, post: m => sent.push(m), epochNow: () => 1234 });
  assert.deepEqual(pub.panic('blackout'), { type: 'panic', v: 1, t: 1234, mode: 'blackout' });
  assert.equal(pub.panic('strobe'), null);
  pub.panic('clear');
  assert.deepEqual(sent.map(m => Panic.panicMode(m)), ['blackout', 'off']);
  // a scene on ?clock=shared ignores panic messages as clock input
  const recv = Clock.create({ source: 'shared', audioContext: () => fakeContext(), timers: false, sharedFeed: true, keys: false, badge: false });
  recv.start(); recv.sharedMessage(sent[0]);
  assert.equal(recv.sharedState.msgs, 0); assert.equal(recv.sharedState.state, 'waiting');
});

test('the conductor: B and ` send blackout / calm to every scene, the same again clears; buttons wired; Help says it (ASCII)', () => {
  const k = (code, mods = {}) => C.pageKey({ code, target: { tagName: 'BODY' }, ...mods });
  assert.deepEqual(k('KeyB'), { type: 'panic', mode: 'blackout' });
  assert.deepEqual(k('Backquote'), { type: 'panic', mode: 'calm' });
  assert.equal(k('KeyB', { shiftKey: true }), null, 'Shift+B is not the panic');
  assert.equal(C.pageKey({ code: 'KeyB', target: { tagName: 'INPUT', type: 'text' } }), null, 'typing');
  assert.equal(C.panicNext('clear', 'blackout'), 'blackout');
  assert.equal(C.panicNext('blackout', 'blackout'), 'clear');
  assert.equal(C.panicNext('blackout', 'calm'), 'calm');
  assert.equal(C.panicNext('calm', 'clear'), 'clear');
  const html = fs.readFileSync(path.join(EX, 'clock-conductor.html'), 'utf8');
  for (const m of ['blackout', 'calm', 'clear']) assert.match(html, new RegExp(`<button data-panic="${m}">[\\x20-\\x7e]+</button>`));
  assert.match(html, /publisher\.panic\(C\.panicNext\(panicSent, mode\)\)/);
  assert.match(html, /else if \(a\.type === 'panic'\) panic\(a\.mode\);/);
  assert.match(html, /<h2>Scenes \(panic\)<\/h2>/);
});

test('every numbered scene loads panic.js and takes ?clock= (so the set\'s query reaches its clock)', () => {
  const pages = fs.readdirSync(EX).filter(f => /^\d\d-.*\.html$/.test(f));
  assert.ok(pages.length >= 20);
  for (const f of pages) assert.match(fs.readFileSync(path.join(EX, f), 'utf8'), /<script src="panic\.js"><\/script>/, f);
});

// ---------- set.html + set.json ----------
test('set.json is valid and its URLs are right: each scene with ?clock=shared&audio=line&in=BlackHole&capture=1', () => {
  const set = JSON.parse(fs.readFileSync(path.join(EX, 'set.json'), 'utf8'));
  assert.deepEqual(SetLib.validate(set), []);
  assert.equal(set.scenes.length, 3);
  const urls = set.scenes.map(s => SetLib.buildUrl(set, s));
  for (const [i, u] of urls.entries()) {
    assert.equal(u, `${set.scenes[i].page}?clock=shared&audio=line&in=BlackHole&capture=1`);
    assert.ok(fs.existsSync(path.join(EX, set.scenes[i].page)), `${set.scenes[i].page} exists`);
    const page = fs.readFileSync(path.join(EX, set.scenes[i].page), 'utf8');
    assert.match(page, /Clock\.create\(\{ source: query\.get\('clock'\)/, `${set.scenes[i].page} reads ?clock=`);
    assert.match(page, /<script src="panic\.js"><\/script>/);
  }
  assert.equal(SetLib.windowFeatures(set, 0), 'popup=yes,width=1920,height=1080,left=0,top=0');
  assert.equal(SetLib.windowFeatures(set, 2), 'popup=yes,width=1920,height=1080,left=80,top=80');
  assert.notEqual(SetLib.windowName(0), SetLib.windowName(1));
});

test('set.js: per-scene query overrides and removes defaults, encodes values; bad pages and bad sets are refused', () => {
  const set = { version: 1, defaults: { clock: 'shared', audio: 'line', in: 'BlackHole', capture: '1' }, scenes: [] };
  assert.equal(SetLib.buildUrl(set, { page: '13-flow-lab.html', query: { in: 'Scarlett 2i2', audio: null, bpm: 128 } }),
    '13-flow-lab.html?clock=shared&in=Scarlett%202i2&capture=1&bpm=128');
  assert.equal(SetLib.buildUrl({ version: 1 }, { page: '13-flow-lab.html' }), '13-flow-lab.html');
  for (const page of ['../secret.html', 'https://x.example/a.html', 'sub/a.html', 'a.js', '']) assert.throws(() => SetLib.buildUrl(set, { page }), /not a page/);
  assert.deepEqual(SetLib.validate({ version: 1, scenes: [{ page: '13-flow-lab.html' }] }), []);
  const bad = SetLib.validate({ version: 2, defaults: { 'bad key': 1, x: {} }, window: { width: 10 }, scenes: [{ page: '../x.html', query: [] }, null] });
  for (const re of [/version/, /bad key/, /defaults\.x/, /window\.width/, /scenes\[0\]\.page/, /scenes\[0\]\.query/, /scenes\[1\]/]) assert.ok(bad.some(e => re.test(e)), `${re}: ${bad.join(' | ')}`);
  assert.deepEqual(SetLib.validate({ version: 1, scenes: [] }), ['scenes: a list with at least one scene']);
});

test('set.html: loads set.json and set.js, opens each scene in its own named window, plain ASCII (#205)', () => {
  const html = fs.readFileSync(path.join(EX, 'set.html'), 'utf8');
  assert.match(html, /<script src="set\.js"><\/script>/);
  assert.match(html, /fetch\('set\.json', \{ cache: 'no-store' \}\)/);
  assert.match(html, /window\.open\(qa\.urls\[i\], SetLib\.windowName\(i\), SetLib\.windowFeatures\(qa\.set, i\)\)/);
  assert.ok(/^[\x00-\x7f]*$/.test(html), 'ASCII only');
  assert.ok(/^[\x00-\x7f]*$/.test(fs.readFileSync(path.join(EX, 'set.json'), 'utf8')), 'set.json ASCII only');
});
