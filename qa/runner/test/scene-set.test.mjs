// Scenes ready for a projector (the apartment MVP, Task 2; the user 14 Nov 14:55): ?in=<label substring> on audio-in
// and the line clock, ?capture=1's layout, panic over the shared clock's channel (conductor -> every scene), and
// set.html's URLs from set.json. No browser here: the DOM side runs in clock-shared-smoke.test.mjs on the box.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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
  // the user's Saturday set (19 Nov 22:04): Hodge, Lenia, Paint Pour without the song's stirring, Riemann's ribbon
  // (12 Mass Gap left the set; its page stays)
  // scene 5 (20 Nov): 27 EQ calibrate with the kick square on, for setting the mixer's EQ at the venue
  // scene 6 (20 Nov): 16c Neon Lines; its thickness knob on the slot's knob 2 (22 Nov)
  // scene 7 (20 Nov): 18 Little Bang's beamline, travel speed on knob 4 (#278)
  // scene 8 (26 Nov): 28 Aurora (the blind grade's winner, #305), height on knob 2, colour on knob 3
  // scene 9 (27 Nov): 18 Little Bang 2 (#326) as "Little Bang Tunnel"; the user keeps both Little Bangs, scene 7 stays
  assert.deepEqual(set.scenes.map(s => s.page), ['16-hodge-kaleidoscope.html', '06-lenia-effects.html', '24-paint-pour.html', '11-riemann-show.html', '27-eq-calibrate.html', '16-neon-lines.html', '18-little-bang.html', '28-aurora.html', '18-little-bang-2.html', '29-neon-tunnel.html']);
  // scene 10 (27 Nov): 29 Neon Tunnel part 1 (#330), added before its audition on the user's word; speed 2, turn 3, colour 4
  assert.deepEqual(set.scenes.slice(6).map(s => s.name), ['Little Bang Beamline', 'Aurora', 'Little Bang Tunnel', 'Neon Tunnel']);
  // the knobs per slot (20 Nov 15:34; slot B adds 4, slot.js): 1 = the beat (defaults; clock.beatGain), then each
  // scene's own from 2: Hodge dive 2 + glints 3, Paint Pour pulse 2 + tilt 3 (21 Nov), Little Bang speed 2; 27 EQ has no beat knob
  assert.equal(set.defaults.beatKnob, '1');
  const extra = ['&beatKnob=1&diveKnob=2&glintKnob=3', '&beatKnob=1&lights=1', '&beatKnob=1&beatFx=0&pulseKnob=2&pulse=1&tilt=0&tiltKnob=3', '&beatKnob=1&scene=ribbon', '&kick=1', '&beatKnob=1&thickKnob=2', '&beatKnob=1&scene=beamline&speedKnob=2', '&beatKnob=1&heightKnob=2&colourKnob=3', '&beatKnob=1&speedKnob=2', '&beatKnob=1&speedKnob=2&turnKnob=3&colourKnob=4'];
  const urls = set.scenes.map(s => SetLib.buildUrl(set, s));
  for (const [i, u] of urls.entries()) {
    assert.equal(u, `${set.scenes[i].page}?clock=shared&audio=line&in=BlackHole&capture=1${extra[i]}`);
    assert.ok(fs.existsSync(path.join(EX, set.scenes[i].page)), `${set.scenes[i].page} exists`);
    const page = fs.readFileSync(path.join(EX, set.scenes[i].page), 'utf8');
    assert.match(page, /Clock\.create\(\{ source: (query\.get|q)\('clock'\)/, `${set.scenes[i].page} reads ?clock=`);
    assert.match(page, /<script src="panic\.js"><\/script>/, `${set.scenes[i].page} loads panic.js (?capture=1: the clean stage, blackout)`);
    assert.match(page, /AudioIn\.create\(/, `${set.scenes[i].page} takes ?audio=line`);
  }
  // the scenes' own switches exist on their pages
  const pour = fs.readFileSync(path.join(EX, '24-paint-pour.html'), 'utf8'), riemann = fs.readFileSync(path.join(EX, '11-riemann-show.html'), 'utf8');
  assert.match(pour, /params\.beatFx = q\('beatFx'\) !== '0'/, '24 reads ?beatFx=0');
  assert.match(pour, /params\.pulseKnob = .*q\('pulseKnob'\)/, '24 reads ?pulseKnob= (#269)');
  // 16's diveKnob / glintKnob come with #271 (VIZ pages); until then the page ignores them
  assert.match(riemann, /const SCENES = \[[^\]]*'ribbon'/, '11 has the ribbon scene');
  const bang = fs.readFileSync(path.join(EX, '18-little-bang.html'), 'utf8');
  assert.match(bang, /const SCENES = \[[^\]]*'beamline'/, '18 has the beamline scene');
  assert.match(bang, /params\.speedKnob = .*q\('speedKnob'\)/, '18 reads ?speedKnob= (#278)');
  const bang2 = fs.readFileSync(path.join(EX, '18-little-bang-2.html'), 'utf8');
  assert.match(bang2, /params\.speedKnob = knobParam\('speedKnob', 2\)/, '18 Little Bang 2 reads ?speedKnob= (#326)');
  const neon29 = fs.readFileSync(path.join(EX, '29-neon-tunnel.html'), 'utf8');
  for (const [k, d] of [['speedKnob', 2], ['turnKnob', 3], ['colourKnob', 4]]) assert.match(neon29, new RegExp(`knobParam\\('${k}', ${d}\\)`), `29 Neon Tunnel reads ?${k}= (#330)`);
  assert.match(riemann, /if \(q\('scene'\) && \(q\('scene'\) === 'auto' \|\| SCENES\.includes\(q\('scene'\)\)\)\) params\.scene = q\('scene'\);/, '11 reads ?scene=');
  assert.deepEqual(set.window, { width: 960, height: 540, bar: 63 }, 'content 960x540 pt + the 63 pt Chrome bar (mac session 18 Nov)');
  assert.notEqual(SetLib.windowName(0), SetLib.windowName(1));
});

// mac session 18 Nov (the user): "Open all scenes" places the windows evenly on a diagonal at the capture size, so they
// are not moved by hand each session. Content 960x540 pt (window.open width/height are the content in Chrome); outer
// 960 x (540 + 63) pt; on Retina 1920x1080 px after OBS's Crop/Pad top 126.
test('set.js windowFeatures: an even diagonal of the available screen at the content size; n = 1; old set.json', () => {
  const set = JSON.parse(fs.readFileSync(path.join(EX, 'set.json'), 'utf8'));
  const mac = { availLeft: 0, availTop: 38, availWidth: 1728, availHeight: 1079 };   // the show Mac, menu bar 38 pt
  assert.deepEqual([0, 1, 2].map(i => SetLib.windowFeatures(set, i, 3, mac)), [
    'popup=yes,width=960,height=540,left=0,top=38',     // Hodge Kaleidoscope
    'popup=yes,width=960,height=540,left=384,top=276',  // Mass Gap
    'popup=yes,width=960,height=540,left=768,top=514',  // Lenia Effects
  ]);
  // n = 1: the corner of the available area
  assert.equal(SetLib.windowFeatures(set, 0, 1, mac), 'popup=yes,width=960,height=540,left=0,top=38');
  // a second screen to the left (negative availLeft), odd steps round to whole numbers
  assert.equal(SetLib.windowFeatures(set, 1, 4, { availLeft: -1920, availTop: 25, availWidth: 1920, availHeight: 1055 }),
    'popup=yes,width=960,height=540,left=-1600,top=176');
  // the window larger than the screen: never left of or above the available area
  const big = { version: 1, window: { width: 1920, height: 1080 }, scenes: [{ page: 'a.html' }, { page: 'b.html' }] };
  for (const i of [0, 1]) assert.equal(SetLib.windowFeatures(big, i, 2, mac), 'popup=yes,width=1920,height=1080,left=0,top=38');
  // an old set.json (width/height only, bar 63 by default) is valid and still lays out
  assert.deepEqual(SetLib.validate(big), []);
  assert.equal(SetLib.windowFeatures({ version: 1, window: { width: 960, height: 540 } }, 2, 3, mac), 'popup=yes,width=960,height=540,left=768,top=514');
  assert.equal(SetLib.windowFeatures({ version: 1 }, 0, 3, { availLeft: 0, availTop: 0, availWidth: 3840, availHeight: 2160 }),
    'popup=yes,width=1920,height=1080,left=0,top=0', 'no window: 1920x1080 as before');
  assert.equal(SetLib.windowFeatures({ version: 1, window: { width: 960, height: 540, bar: 0 } }, 1, 2, mac), 'popup=yes,width=960,height=540,left=768,top=577');
  // no screen (old callers): the old 40 px cascade
  assert.equal(SetLib.windowFeatures(big, 2), 'popup=yes,width=1920,height=1080,left=80,top=80');
  // bar limits
  for (const bar of [-1, 201, 1.5, '63']) assert.ok(SetLib.validate({ version: 1, window: { bar }, scenes: [{ page: 'a.html' }] }).some(e => /window\.bar/.test(e)), `bar ${bar}`);
  for (const bar of [0, 63, 200]) assert.deepEqual(SetLib.validate({ version: 1, window: { bar }, scenes: [{ page: 'a.html' }] }), []);
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
  assert.match(html, /window\.open\(qa\.urls\[i\], SetLib\.windowName\(i\), SetLib\.windowFeatures\(qa\.set, i, qa\.set\.scenes\.length, window\.screen\)\)/);
  assert.ok(/^[\x00-\x7f]*$/.test(html), 'ASCII only');
  assert.ok(/^[\x00-\x7f]*$/.test(fs.readFileSync(path.join(EX, 'set.json'), 'utf8')), 'set.json ASCII only');
});

// 16 Nov: set.html's top-level `function open(i)` replaced window.open (a classic script's function declarations become
// properties of window), so its own window.open(...) called itself until "Maximum call stack size exceeded" and no
// scene window opened. Here the page's inline script runs with the fake window as its global, as in a browser.
test('set.html: "Open all scenes" and each "Open" call the browser\'s window.open, once per scene (no self-call)', async () => {
  const html = fs.readFileSync(path.join(EX, 'set.html'), 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.equal(inline.length, 1, 'one inline script');
  const set = JSON.parse(fs.readFileSync(path.join(EX, 'set.json'), 'utf8'));
  const els = {}, el = id => (els[id] ||= { id, textContent: '', onclick: null, children: [], appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); } });
  const opened = [];
  const win = {
    document: { getElementById: el, createElement: tag => ({ tag, textContent: '', className: '', onclick: null, children: [], appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); } }) },
    fetch: async () => ({ ok: true, json: async () => set }),
    open: (url, name, features) => { opened.push({ url, name, features }); return {}; },
    screen: { availLeft: 0, availTop: 38, availWidth: 1728, availHeight: 1079 },
  };
  win.window = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(EX, 'set.js'), 'utf8'), ctx);
  vm.runInContext(inline[0], ctx);
  await new Promise(r => setImmediate(r));
  assert.equal(win.__qa.set.urls.length, set.scenes.length, 'set.json loaded');
  el('openAll').onclick();
  assert.equal(opened.length, set.scenes.length, 'one window.open per scene');
  const n = set.scenes.length;   // the diagonal from the page's screen, for however many scenes the set has (4 since 19 Nov)
  assert.deepEqual(opened.map(o => o.features.replace(/^.*left=/, 'left=')),
    set.scenes.map((s, i) => `left=${Math.round(i * (1728 - 960) / (n - 1))},top=${Math.round(38 + i * (1079 - 603) / (n - 1))}`), 'the diagonal from the page\'s screen');
  assert.equal(opened[0].features.replace(/^.*left=/, 'left='), 'left=0,top=38');
  assert.equal(opened[n - 1].features.replace(/^.*left=/, 'left='), 'left=768,top=514', 'the last one in the far corner');
  assert.deepEqual(opened.map(o => o.name), set.scenes.map((s, i) => `cellular-viz-set-${i}`));
  assert.deepEqual(opened.map(o => o.url), win.__qa.set.urls);
  const openBtn = el('list').children[0].children[2].children[0];
  openBtn.onclick();
  assert.equal(opened.length, set.scenes.length + 1, 'the row button opens its scene');
  assert.equal(el('status').textContent.startsWith('opened: '), true);
});

// Saturday brief task 2: one input label for every scene. set.html?in=<label> fills the "Input" field, the field wins
// over set.json's defaults.in (and a scene's own in=) in every URL it opens; empty: set.json's. The page's inline
// script runs with a fake window (as above), location.search included.
test('set.html: the input label (field or ?in=) goes to every scene as in=<label>, over set.json; empty: set.json\'s', async () => {
  const set = { version: 1, defaults: { clock: 'shared', audio: 'line', in: 'BlackHole', capture: '1' },
    scenes: [{ page: '16-hodge-kaleidoscope.html' }, { page: '12-mass-gap.html', query: { in: 'Loopback' } }, { page: '06-lenia-effects.html' }] };
  assert.equal(SetLib.buildUrl(set, set.scenes[0], { in: 'USB Audio' }), '16-hodge-kaleidoscope.html?clock=shared&audio=line&in=USB%20Audio&capture=1');
  assert.equal(SetLib.buildUrl(set, set.scenes[1], { in: 'USB Audio' }), '12-mass-gap.html?clock=shared&audio=line&in=USB%20Audio&capture=1', 'over the scene\'s own in=');
  assert.equal(SetLib.buildUrl(set, set.scenes[1], null), '12-mass-gap.html?clock=shared&audio=line&in=Loopback&capture=1');
  assert.equal(SetLib.queryIn('?in=USB%20Audio&x=1'), 'USB Audio');
  assert.equal(SetLib.queryIn('?x=1&in=Scarlett+2i2'), 'Scarlett 2i2');
  assert.equal(SetLib.queryIn('?pin=1'), '');
  assert.equal(SetLib.queryIn(''), '');
  assert.equal(SetLib.queryIn(undefined), '');

  const html = fs.readFileSync(path.join(EX, 'set.html'), 'utf8');
  assert.match(html, /<input id="inLabel" type="text"/);
  assert.ok(/^[\x00-\x7f]*$/.test(html), 'ASCII only');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.equal(inline.length, 1);
  const page = search => {
    const els = {}, el = id => (els[id] ||= { id, value: undefined, textContent: '', onclick: null, oninput: null, children: [], appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); } });
    const opened = [];
    const win = {
      document: { getElementById: el, createElement: tag => ({ tag, textContent: '', className: '', onclick: null, children: [], appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); } }) },
      fetch: async () => ({ ok: true, json: async () => set }),
      open: (url, name) => { opened.push({ url, name }); return {}; },
      location: { search },
    };
    win.window = win; win.globalThis = win;
    const ctx = vm.createContext(win);
    vm.runInContext(fs.readFileSync(path.join(EX, 'set.js'), 'utf8'), ctx);
    vm.runInContext(inline[0], ctx);
    return { win, el, opened };
  };
  // ?in= on set.html
  const a = page('?in=USB%20Audio');
  await new Promise(r => setImmediate(r));
  assert.equal(a.el('inLabel').value, 'USB Audio', 'the field shows ?in=');
  a.el('openAll').onclick();
  assert.equal(a.opened.length, 3);
  for (const o of a.opened) assert.match(o.url, /[?&]in=USB%20Audio(&|$)/, o.url);
  assert.ok(a.opened.every(o => !/BlackHole|Loopback/.test(o.url)), 'set.json\'s in= is replaced in every URL');
  assert.equal(a.win.__qa.set.inLabel, 'USB Audio');
  // typing in the field: the URLs follow; empty: set.json's
  a.el('inLabel').value = 'Scarlett 2i2'; a.el('inLabel').oninput();
  a.el('openAll').onclick();
  assert.deepEqual(a.opened.slice(3).map(o => o.url), set.scenes.map(s => SetLib.buildUrl(set, s, { in: 'Scarlett 2i2' })));
  a.el('inLabel').value = '  '; a.el('inLabel').oninput();
  a.el('openAll').onclick();
  assert.deepEqual(a.opened.slice(6).map(o => o.url), set.scenes.map(s => SetLib.buildUrl(set, s)), 'empty field: set.json as it is');
  assert.equal(a.win.__qa.set.inLabel, null);
  // no ?in=: set.json as it is
  const b = page('');
  await new Promise(r => setImmediate(r));
  assert.equal(b.el('inLabel').value, '');
  b.el('openAll').onclick();
  assert.deepEqual(b.opened.map(o => o.url), set.scenes.map(s => SetLib.buildUrl(set, s)));
});

// Mac session 4 (20 Nov): on Paint Pour the beat knob alone showed nothing, because the colour pulse started at 0 until
// knob 2 / 6 moved. The set now starts it at pulse=1 (the page's ?pulse, its full design amount: +8 % brightness and more
// saturation on each beat at beat knob middle, g = 1); the pulse knob takes over once it moves.
test('Paint Pour in the set: the pulse is on before knob 2 / 6 moves, so beat knob 1 / 5 alone shows the beat; the knob takes over once moved', async () => {
  const set = JSON.parse(fs.readFileSync(path.join(EX, 'set.json'), 'utf8'));
  const pour = set.scenes.find(s => s.page === '24-paint-pour.html');
  assert.deepEqual(pour.query, { beatFx: '0', pulseKnob: '2', pulse: '1', tilt: '0', tiltKnob: '3' });
  const P = await import('../../../experiments/24-paint-pour.mjs'), K = await import('../../../experiments/24-marble.mjs');
  const def = P.DETAIL.find(d => d.name === 'pulse');
  assert.ok(def && def.type === 'float' && def.min === 0 && def.max === 1, 'the page reads ?pulse=0..1');
  const page = fs.readFileSync(path.join(EX, '24-paint-pour.html'), 'utf8');
  assert.match(page, /pulse: K\.pulseAmount\(clock, params\.pulseKnob, params\.pulse\)/, 'knob first, else ?pulse');
  // the shared clock's knobs: pulse knob 2 untouched (null), beat knob 1 at the middle
  const knobs = [0.5, null, null, null, null, null, null, null], clock = { knob: n => knobs[n - 1] };
  const atBeat = (beatKnob, pulseKnob) => {
    const amount = K.pulseAmount(clock, pulseKnob, +pour.query.pulse);
    return P.beatTerms(Clock.beatGain(knobs[beatKnob - 1]), 0, amount * K.beatPulse(0)).pulse;   // on the beat
  };
  assert.equal(atBeat(1, 2), 1, 'beat knob middle, pulse knob untouched: the full pulse (+8 % on the beat)');
  assert.equal(K.beatPulse(0.5), 0, 'off the beat: no pulse (a bump, not a constant lift)');
  knobs[0] = 1; assert.equal(atBeat(1, 2), P.BEAT.PULSE_CAP, 'beat knob top: 3x, at its cap');
  knobs[0] = 0; assert.equal(atBeat(1, 2), 0, 'beat knob down: no beat');
  knobs[0] = 0.5; knobs[1] = 0.4;
  assert.ok(Math.abs(atBeat(1, 2) - 0.4) < 1e-12, 'pulse knob moved: its value, as before');
  knobs[1] = 0; assert.equal(atBeat(1, 2), 0, 'pulse knob down: off, as before');
  // slot B: knobs 5 / 6 the same way (slot.js adds 4)
  const SlotLib = require(path.join(EX, 'slot.js'));
  assert.deepEqual(SlotLib.slotKnobs(set, pour, 'B'), { beatKnob: '5', pulseKnob: '6', tiltKnob: '7' });
});

// the tilted plane (the user, 20 Nov 22:21): knob 3 / 7 tips Paint Pour's plane and the paint runs downhill. The set starts
// flat (tilt=0), so Sunday's Paint Pour looks as on main until knob 3 / 7 is turned; the standalone page's default is 35
test('Paint Pour in the set: loads at tilt 0 (flat, as before) with knob 3 / 7 mapped to 0-60 degrees through the pick-up', async () => {
  const set = JSON.parse(fs.readFileSync(path.join(EX, 'set.json'), 'utf8'));
  const pour = set.scenes.find(s => s.page === '24-paint-pour.html');
  assert.equal(pour.query.tilt, '0', 'the set plays Paint Pour flat');
  assert.equal(pour.query.tiltKnob, '3', 'the tilt on the slot\'s knob 3');
  const P = await import('../../../experiments/24-paint-pour.mjs'), K = await import('../../../experiments/24-marble.mjs');
  const def = P.DETAIL.find(d => d.name === 'tilt');
  assert.ok(def && def.type === 'float' && def.min === 0 && def.max === 60 && def.default === 35, 'the page reads ?tilt=0..60, 35 standalone');
  const page = fs.readFileSync(path.join(EX, '24-paint-pour.html'), 'utf8');
  assert.match(page, /params\.tiltKnob = .*q\('tiltKnob'\)/, '24 reads ?tiltKnob=');
  assert.match(page, /return 60 \* K\.pulseAmount\(clock, params\.tiltKnob, params\.tilt \/ 60\);/, 'the knob once moved (pick-up), else ?tilt');
  assert.match(page, /tilt: tiltTarget\(\),/, 'the scene gets the target angle');
  // the set's values through the page's own arithmetic: knob 3 untouched -> ?tilt=0 -> flat, nothing moves
  const knobs = [0.5, 0.3, null, null, null, null, null, null], clock = { knob: n => knobs[n - 1] };
  const target = () => 60 * K.pulseAmount(clock, +pour.query.tiltKnob, +pour.query.tilt / 60);
  assert.equal(target(), 0, 'knob 3 untouched: tilt 0');
  assert.equal(P.tiltEffective(target(), 0.05, 3), 0, 'tilt 0: no kick breath either (it fades in over 0-10 degrees)');
  assert.equal(P.downhillSpeed(1, P.tiltEffective(target(), 0.05, 1)), 0, 'tilt 0: nothing slides');
  assert.equal(P.scrollSpeed(target(), 2), 0, 'tilt 0: the camera stays put');
  knobs[2] = 1; assert.equal(target(), 60, 'knob 3 up: 60 degrees');
  knobs[2] = 0.5; assert.equal(target(), 30, 'linear in the angle');
  // the angle follows the knob at <= 60 degrees a second (not beat-quantised)
  let d = P.slewTilt(null, 0, 0); for (let f = 0; f < 30; f++) d = P.slewTilt(d, 60, 1 / 60);
  assert.ok(Math.abs(d - 30) < 1e-9, `half a second after a slam to 60: 30 degrees (${d})`);
  const SlotLib = require(path.join(EX, 'slot.js'));
  assert.equal(SlotLib.slotKnobs(set, pour, 'A').tiltKnob, '3');
  assert.equal(SlotLib.slotKnobs(set, pour, 'B').tiltKnob, '7', 'slot B: knob 7');
});
