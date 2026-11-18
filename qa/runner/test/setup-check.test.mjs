// The Mac setup check (the user, 16 Nov 15:57): experiments/setup-check.mjs (the browser page's rules) with fake port and
// device lists, the page itself (plain ASCII, the shared clock channel), and tools/mac-check.sh: `sh -n`, then a run
// with a fake Mac (MAC_CHECK_FAKE canned command output, MAC_CHECK_ROOT a fake /Applications) whose --json parses.
//   node --test qa/runner/test/setup-check.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.join(here, '..', '..', '..');
const EXP = path.join(REPO, 'experiments'), SCRIPT = path.join(REPO, 'tools', 'mac-check.sh');
const S = await import('../../../experiments/setup-check.mjs');

test('setup-check: MIDI ports -> the LCXL3 DAW ports and IAC Driver Bus 1, each PASS or FAIL with a fix step', () => {
  const good = S.classifyMidi({ inputs: ['LCXL3 1 MIDI Out', 'LCXL3 1 DAW Out', 'IAC Driver Bus 1'], outputs: ['LCXL3 1 MIDI In', 'LCXL3 1 DAW In', 'IAC Driver Bus 1'] });
  assert.deepEqual(good.map(r => [r.item, r.status]), [['LCXL3 DAW ports', 'PASS'], ['IAC Driver Bus 1', 'PASS']]);
  assert.ok(good.every(r => r.fix === ''), 'no fix step on PASS');
  const noIac = S.classifyMidi({ inputs: ['LCXL3 1 DAW Out'], outputs: ['LCXL3 1 DAW In'] });
  assert.equal(noIac[1].status, 'FAIL');
  assert.equal(noIac[1].fix, 'Open Audio MIDI Setup. Open MIDI Studio. Double-click IAC Driver. Select Device is online');
  // the Resolume side of the bus, shown with the IAC row whatever its status (VIZ research, 16 Nov)
  for (const r of [good[1], noIac[1]]) assert.equal(r.hint, 'In Resolume, open Preferences > MIDI. Turn on MIDI Input for IAC Driver Bus 1. Open the MIDI monitor to see the messages.');
  assert.equal(good[0].hint, undefined);
  const noDaw = S.classifyMidi({ inputs: ['LCXL3 1 MIDI Out'], outputs: ['LCXL3 1 MIDI In', 'IAC Driver Bus 1'] });
  assert.deepEqual(noDaw.map(r => r.status), ['FAIL', 'PASS'], 'the MIDI port alone is not the DAW port');
  assert.match(noDaw[0].detail, /input and output not found/);
  assert.match(S.classifyMidi({ inputs: ['LCXL3 1 DAW Out'], outputs: ['IAC Driver Bus 1'] })[0].detail, /DAW output not found/);
  const none = S.classifyMidi({ error: 'SecurityError' });
  assert.equal(none.length, 1); assert.equal(none[0].status, 'FAIL'); assert.match(none[0].fix, /Allow MIDI with system exclusive/);
});

test('setup-check: audio input labels -> BlackHole; WebGL2, secure context, clock and panic rows; the summary', () => {
  assert.equal(S.classifyAudioInputs(['MacBook Pro Microphone', 'BlackHole 2ch (Virtual)']).status, 'PASS');
  const missing = S.classifyAudioInputs(['MacBook Pro Microphone']);
  assert.equal(missing.status, 'FAIL'); assert.match(missing.fix, /Install BlackHole 2ch from existential\.audio/);
  assert.equal(S.classifyAudioInputs(['', '']).status, 'WARN', 'no labels: no permission yet');
  assert.equal(S.classifyAudioInputs([], { permission: false, error: 'NotAllowedError' }).status, 'FAIL');
  assert.equal(S.classifyWebgl(true, 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)').status, 'PASS');
  assert.equal(S.classifyWebgl(true, 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)').status, 'WARN');
  assert.equal(S.classifyWebgl(false, null).status, 'FAIL');
  assert.equal(S.classifySecure(true).status, 'PASS');
  assert.equal(S.classifySecure(false, 'http://192.168.8.164:8790/').status, 'FAIL');
  const clockMsg = { type: 'clock', v: 1, t: 1, beats: 12.5, bpm: 128, phase: 0.5, bar: 3, beatInBar: 0, bpb: 4, confidence: 0.9, state: 'locked', offsetMs: 0 };
  assert.equal(S.classifyClock([{ type: 'jump', v: 1 }, clockMsg]).status, 'PASS');
  assert.match(S.classifyClock([clockMsg]).detail, /128\.0 bpm, state locked/);
  const silent = S.classifyClock([{ type: 'panic', v: 1, mode: 'clear' }]);
  assert.equal(silent.status, 'FAIL'); assert.match(silent.fix, /Open the conductor page/);
  assert.equal(S.classifyPanic(true).status, 'PASS'); assert.equal(S.classifyPanic(false, 'x').status, 'FAIL');
  assert.deepEqual(S.summary([{ status: 'PASS' }, { status: 'WARN' }, { status: 'FAIL' }, { status: 'PASS' }]), { pass: 2, warn: 1, fail: 1, ok: false });
  assert.equal(S.summary([{ status: 'PASS' }]).ok, true);
});

test('setup-check: the channel is the shared clock\'s (clock.js and panic.js), and the clock message shape is clock.js publish()', () => {
  const clock = fs.readFileSync(path.join(EXP, 'clock.js'), 'utf8'), panic = fs.readFileSync(path.join(EXP, 'panic.js'), 'utf8');
  assert.equal(/SHARED_CHANNEL = '([^']+)'/.exec(clock)[1], S.CLOCK_CHANNEL);
  assert.equal(/CHANNEL = '([^']+)'/.exec(panic)[1], S.CLOCK_CHANNEL);
  assert.match(clock, /const m = \{ type: 'clock', v: 1, t: e, beats: r\.beats, bpm: r\.bpm/, 'the message classifyClock reads');
  // the controller's port rules (midi-controller.js) and the bridge's bus
  const midi = fs.readFileSync(path.join(EXP, 'midi-controller.js'), 'utf8');
  assert.match(midi, /DEVICE_PORT = \/LCXL3\//); assert.match(midi, /\/DAW\/\.test\(p\.name/);
});

test('setup-check: set.json -> the pages to check, every one a file in experiments/; the page is plain ASCII and served by name', () => {
  const set = JSON.parse(fs.readFileSync(path.join(EXP, 'set.json'), 'utf8'));
  const urls = S.setUrls(set);
  assert.deepEqual(urls.slice(0, 3), ['/experiments/clock-conductor.html', '/experiments/set.html', '/experiments/set.json']);
  assert.equal(urls.length, 3 + set.scenes.length);
  for (const u of urls) assert.ok(fs.existsSync(path.join(EXP, u.replace('/experiments/', ''))), `${u} exists`);
  assert.deepEqual(S.setUrls({ scenes: [{ page: 'a.html' }, { page: 'a.html' }, {}, null] }), ['/experiments/clock-conductor.html', '/experiments/set.html', '/experiments/set.json', '/experiments/a.html']);
  assert.equal(S.setUrls(null).length, 3);
  const html = fs.readFileSync(path.join(EXP, 'setup-check.html'), 'utf8');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(html), 'setup-check.html is plain ASCII (#205)');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(fs.readFileSync(path.join(EXP, 'setup-check.mjs'), 'utf8')), 'setup-check.mjs is plain ASCII');
  assert.match(html, /import \* as S from '\.\/setup-check\.mjs';/);
  assert.match(html, /new BroadcastChannel\(S\.CLOCK_CHANNEL\)/);
  assert.match(html, /requestMIDIAccess\(\{ sysex: true \}\)/);
  assert.match(html, /<button id="run">Run checks<\/button>/);
  const serve = fs.readFileSync(path.join(REPO, 'qa', 'conduct-serve.mjs'), 'utf8'), safe = new RegExp(/SAFE_FILE = \/(.+)\/;/.exec(serve)[1]);
  for (const f of ['setup-check.html', 'setup-check.mjs']) assert.ok(safe.test(f), `${f} is served by conduct-serve`);
});

/** a fake Mac: canned command output and a fake /Applications, then the script with the given flags */
function fakeMac({ pages404 = [], noBlackHole = false, wifiOn = false, obs = null, usb = 'USB:\n    Launch Control XL 3:\n      Product ID: 0x0001\n', chromePs = null, lineIn = 'USB Audio CODEC', mic = false } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-check-')), cmd = path.join(d, 'cmd'), root = path.join(d, 'root');
  const mk = p => fs.mkdirSync(path.join(root, p), { recursive: true });
  fs.mkdirSync(cmd, { recursive: true });
  mk('Applications/Google Chrome.app/Contents'); mk('Applications/Resolume Arena/Arena.app/Contents'); mk('Applications/NDI Tools/NDI Scan Converter.app');
  fs.writeFileSync(path.join(root, 'Applications/Google Chrome.app/Contents/Info.plist'), 'CFBundleShortVersionString=131.0.6778.86\n');
  fs.writeFileSync(path.join(root, 'Applications/Resolume Arena/Arena.app/Contents/Info.plist'), 'CFBundleShortVersionString=7.21.0\n');
  if (obs) { mk('Applications/OBS.app/Contents'); fs.writeFileSync(path.join(root, 'Applications/OBS.app/Contents/Info.plist'), `CFBundleShortVersionString=${obs}\n`); }
  const w = (n, s) => fs.writeFileSync(path.join(cmd, n), s);
  w('sw_vers', '14.5\n'); w('arm64', 'yes\n'); w('cpu', 'Apple M2\n'); w('tunnel', 'yes\n');
  w('wifi_ports', 'Hardware Port: Ethernet\nDevice: en1\nEthernet Address: 00:00:00:00:00:01\n\nHardware Port: Wi-Fi\nDevice: en0\nEthernet Address: 00:00:00:00:00:02\n');
  w('wifi_power', `Wi-Fi Power (en0): ${wifiOn ? 'On' : 'Off'}\n`);
  w('sp_audio', ['Audio:', '', '    Devices:', '', ...(noBlackHole ? [] : ['        BlackHole 2ch:', '', '          Input Channels: 2', '']),
    ...(lineIn ? [`        ${lineIn}:`, '', '          Input Channels: 2', '          Manufacturer: Generic', '          Output Channels: 2', ''] : []),
    ...(mic ? ['        MacBook Pro Microphone:', '', '          Default Input Device: Yes', '          Input Channels: 1', ''] : []),
    '        Multi-Output Device:', '', '          Default Output Device: Yes', '          Output Channels: 2', '', '        MacBook Pro Speakers:', '', '          Output Channels: 2', ''].join('\n'));
  w('sp_usb', usb);
  if (chromePs !== null) w('chrome_ps', chromePs);
  w('sp_displays', 'Graphics/Displays:\n    Apple M2:\n      Displays:\n        Color LCD:\n          Resolution: 3024 x 1964 Retina\n        Projector:\n          Resolution: 1920 x 1080 (1080p FHD - Full High Definition)\n');
  const set = fs.readFileSync(path.join(EXP, 'set.json'), 'utf8');
  w('set_json', set);
  w('http', S.setUrls(JSON.parse(set)).map(u => `${u} ${pages404.includes(u) ? 404 : 200}`).join('\n') + '\n');
  return { d, env: { ...process.env, MAC_CHECK_FAKE: cmd, MAC_CHECK_ROOT: root, MAC_CHECK_HOME: '/nohome' } };
}

test('mac-check.sh: sh -n passes; with a fake Mac --json parses, every row has a status, and a FAIL makes exit code 1', () => {
  const n = spawnSync('sh', ['-n', SCRIPT], { encoding: 'utf8' });
  assert.equal(n.status, 0, `sh -n: ${n.stderr}`);
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(src), 'plain ASCII');
  assert.match(src, /Open the tunnel: \$TUNNEL/); assert.match(src, /TUNNEL='ssh -L 8790:localhost:8790 puggie@192\.168\.8\.164'/);
  const a = fakeMac();
  try {
    const r = spawnSync('sh', [SCRIPT, '--json', '--no-open'], { encoding: 'utf8', env: a.env });
    let j;
    assert.doesNotThrow(() => { j = JSON.parse(r.stdout); }, `--json output parses: ${r.stdout} ${r.stderr}`);
    assert.equal(j.tool, 'mac-check');
    assert.ok(j.results.every(x => ['PASS', 'WARN', 'FAIL', 'INFO'].includes(x.status) && x.item && typeof x.detail === 'string'));
    const by = Object.fromEntries(j.results.map(x => [x.item, x]));
    for (const k of ['macOS', 'Google Chrome', 'BlackHole 2ch', 'Multi-Output Device', 'Default output', 'Line input', 'LCXL3 on USB', 'Displays', 'Resolume', 'Capture route NDI Scan Converter', 'Wi-Fi', 'Tunnel', 'Pages']) assert.equal(by[k] && by[k].status, 'PASS', `${k}: ${JSON.stringify(by[k])}`);
    // the capture routes in VIZ research's order: NDI Scan Converter, OBS + DistroAV + NDI runtime, Syphon
    const at = k => j.results.findIndex(x => x.item === k);
    assert.ok(at('Capture route NDI Scan Converter') < at('Capture route OBS NDI') && at('Capture route OBS NDI') < at('Capture route Syphon'), 'route order');
    assert.deepEqual([by['Capture route OBS NDI'].status, by['Capture route Syphon'].status], ['INFO', 'INFO'], 'not ready is info while another route is ready');
    assert.equal(by['Local Network'].status, 'INFO');
    assert.equal(by['Scan Converter'].status, 'INFO');
    assert.equal(by['Scan Converter'].detail, 'Scan Converter sends one window per instance. Three scenes need three instances, or use OBS + DistroAV');
    assert.equal(by['OBS version'], undefined, 'no OBS, no OBS version row');
    assert.equal(by['Local Network'].detail, 'Allow Resolume in System Settings > Privacy & Security > Local Network');
    assert.match(by['Google Chrome'].detail, /131\.0\.6778\.86/); assert.match(by.Displays.detail, /^2 displays/);
    assert.deepEqual(j.summary, { pass: j.results.filter(x => x.status === 'PASS').length, warn: 0, fail: 0 });
    assert.equal(r.status, 0, 'no FAIL: exit code 0');
    assert.equal(j.browserCheck, 'http://localhost:8790/experiments/setup-check.html');
  } finally { fs.rmSync(a.d, { recursive: true, force: true }); }
  const b = fakeMac({ noBlackHole: true, pages404: ['/experiments/12-mass-gap.html'] });
  try {
    const r = spawnSync('sh', [SCRIPT, '--no-open'], { encoding: 'utf8', env: b.env });
    assert.equal(r.status, 1, 'a FAIL: exit code 1');
    assert.match(r.stdout, /^FAIL BlackHole 2ch: not found\. Install BlackHole 2ch from existential\.audio$/m);
    assert.match(r.stdout, /^FAIL Page 12-mass-gap\.html: HTTP 404\. /m);
    assert.match(r.stdout, /^Summary: \d+ PASS, 0 WARN, 2 FAIL$/m);
    assert.match(r.stdout, /^Browser check: http:\/\/localhost:8790\/experiments\/setup-check\.html$/m);
  } finally { fs.rmSync(b.d, { recursive: true, force: true }); }
});

test('mac-check.sh: no tunnel is a FAIL with the ssh step; Wi-Fi on is a WARN; an unknown option exits 2', () => {
  const c = fakeMac({ wifiOn: true, obs: '30.2.3' });
  try {
    fs.rmSync(path.join(c.env.MAC_CHECK_FAKE, 'tunnel'));
    const r = spawnSync('sh', [SCRIPT, '--no-open'], { encoding: 'utf8', env: c.env });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^FAIL Tunnel: port 8790 is not open on localhost\. Open the tunnel: ssh -L 8790:localhost:8790 puggie@192\.168\.8\.164$/m);
    assert.match(r.stdout, /^WARN Wi-Fi: Wi-Fi \(en0\) is on\. Turn off Wi-Fi while you set up NDI\. NDI on a Mac uses Wi-Fi when it is on$/m);
    assert.match(r.stdout, /^INFO Local Network: Allow Resolume in System Settings > Privacy & Security > Local Network$/m);
    // DistroAV 6.2.x needs OBS 31.1.1 or later and the NDI runtime 6.3 or later (its 6.2.0 release notes)
    assert.match(r.stdout, /^WARN OBS version: OBS 30\.2\.3 is below 31\.1\.1 \(DistroAV 6\.2 needs 31\.1\.1 or later\)\. Update OBS to 31\.1\.1 or later from obsproject\.com$/m);
    assert.match(r.stdout, /^INFO NDI runtime version: not found/m);
    const d = fakeMac({ obs: '31.1.1' });
    try {
      assert.match(spawnSync('sh', [SCRIPT, '--no-open'], { encoding: 'utf8', env: d.env }).stdout, /^PASS OBS version: OBS 31\.1\.1 /m);
    } finally { fs.rmSync(d.d, { recursive: true, force: true }); }
    assert.equal(spawnSync('sh', [SCRIPT, '--bogus'], { encoding: 'utf8', env: c.env }).status, 2);
  } finally { fs.rmSync(c.d, { recursive: true, force: true }); }
});

/** the fake Mac's --json rows by item */
function macRows(opts) {
  const m = fakeMac(opts);
  try {
    const r = spawnSync('sh', [SCRIPT, '--json', '--no-open'], { encoding: 'utf8', env: m.env });
    return Object.fromEntries(JSON.parse(r.stdout).results.map(x => [x.item, x]));
  } finally { fs.rmSync(m.d, { recursive: true, force: true }); }
}

// The Resolume setup, 16 Nov: system_profiler lists the controller as "LCXL3 1", and the old check (grep "Launch Control")
// gave a false WARN.
test('mac-check.sh: the controller listed as "LCXL3 1" is PASS; "Launch Control XL 3" too; no controller is a WARN', () => {
  const lcxl3 = macRows({ usb: 'USB:\n\n    USB 3.1 Bus:\n\n        LCXL3 1:\n\n          Product ID: 0x0001\n          Vendor ID: 0x1235\n' })['LCXL3 on USB'];
  assert.equal(lcxl3.status, 'PASS', JSON.stringify(lcxl3));
  assert.equal(lcxl3.detail, 'found: LCXL3 1');
  const old = macRows({})['LCXL3 on USB'];
  assert.equal(old.status, 'PASS'); assert.equal(old.detail, 'found: Launch Control XL 3');
  const none = macRows({ usb: 'USB:\n    USB Keyboard:\n      Product ID: 0x0002\n' })['LCXL3 on USB'];
  assert.equal(none.status, 'WARN'); assert.equal(none.fix, 'Connect the Launch Control XL 3 with a USB cable');
});

// The Resolume setup, 16 Nov: Chrome stops drawing a fully covered window, so OBS captured a still frame. The check reads
// the main Chrome process's arguments (ps); helper processes do not count.
test('mac-check.sh: Chrome occlusion is PASS with --disable-backgrounding-occluded-windows, WARN without it, INFO when Chrome is not running', () => {
  const MAIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const HELPER = '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/157.0.8103.79/Helpers/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer) --type=renderer';
  const ps = main => ['/sbin/launchd', '/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder', main, HELPER, ''].join('\n');
  const on = macRows({ chromePs: ps(`${MAIN} --disable-backgrounding-occluded-windows`) })['Chrome occlusion'];
  assert.equal(on.status, 'PASS', JSON.stringify(on));
  assert.equal(on.detail, 'Chrome runs with --disable-backgrounding-occluded-windows');
  const off = macRows({ chromePs: ps(MAIN) })['Chrome occlusion'];
  assert.equal(off.status, 'WARN', JSON.stringify(off));
  assert.equal(off.fix, 'Quit Chrome. Run: open -na "Google Chrome" --args --disable-backgrounding-occluded-windows');
  assert.match(off.detail, /still frame/);
  // the flag on a helper only is not enough
  assert.equal(macRows({ chromePs: ps(MAIN).replace('--type=renderer', '--type=renderer --disable-backgrounding-occluded-windows') })['Chrome occlusion'].status, 'WARN');
  const notRunning = macRows({ chromePs: ps('/usr/bin/true') })['Chrome occlusion'];
  assert.equal(notRunning.status, 'INFO'); assert.match(notRunning.detail, /^Chrome is not running/);
  assert.equal(macRows({})['Chrome occlusion'].status, 'INFO', 'no ps output: not running');
  // the text output: the WARN line with its fix step
  const m = fakeMac({ chromePs: ps(MAIN) });
  try {
    const r = spawnSync('sh', [SCRIPT, '--no-open'], { encoding: 'utf8', env: m.env });
    assert.match(r.stdout, /^WARN Chrome occlusion: Chrome runs without --disable-backgrounding-occluded-windows: .*\. Quit Chrome\. Run: open -na "Google Chrome" --args --disable-backgrounding-occluded-windows$/m);
  } finally { fs.rmSync(m.d, { recursive: true, force: true }); }
});

// Saturday brief task 4: a line input for the guest DJ (a USB audio interface). Every device with input channels,
// minus BlackHole and the Mac's own microphone, is named (PASS); only those two, or none: WARN with the fix.
test('mac-check.sh: "Line input" names the inputs other than BlackHole and the built-in microphone; only those, or none: WARN', () => {
  const both = macRows({ lineIn: 'Scarlett 2i2 USB', mic: true })['Line input'];
  assert.equal(both.status, 'PASS', JSON.stringify(both));
  assert.equal(both.detail, 'Scarlett 2i2 USB', 'BlackHole 2ch and MacBook Pro Microphone are not named');
  const only = macRows({ lineIn: null, mic: true })['Line input'];
  assert.equal(only.status, 'WARN', JSON.stringify(only));
  assert.equal(only.detail, 'only BlackHole 2ch, MacBook Pro Microphone');
  assert.equal(only.fix, 'Connect the USB audio interface. Then run this tool again. Fallback: the built-in microphone');
  assert.equal(macRows({ lineIn: null })['Line input'].detail, 'only BlackHole 2ch');
  const none = macRows({ lineIn: null, noBlackHole: true })['Line input'];
  assert.deepEqual([none.status, none.detail], ['WARN', 'no audio input found']);
  // output-only devices (the speakers, the Multi-Output Device) are never inputs
  assert.equal(macRows({})['Line input'].detail, 'USB Audio CODEC');
  const m = fakeMac({ lineIn: null, mic: true });
  try {
    const r = spawnSync('sh', [SCRIPT, '--no-open'], { encoding: 'utf8', env: m.env });
    assert.match(r.stdout, /^WARN Line input: only BlackHole 2ch, MacBook Pro Microphone\. Connect the USB audio interface\. Then run this tool again\. Fallback: the built-in microphone$/m);
  } finally { fs.rmSync(m.d, { recursive: true, force: true }); }
});
