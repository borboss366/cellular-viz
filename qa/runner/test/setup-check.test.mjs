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
function fakeMac({ pages404 = [], noBlackHole = false } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-check-')), cmd = path.join(d, 'cmd'), root = path.join(d, 'root');
  const mk = p => fs.mkdirSync(path.join(root, p), { recursive: true });
  fs.mkdirSync(cmd, { recursive: true });
  mk('Applications/Google Chrome.app/Contents'); mk('Applications/Resolume Arena/Arena.app/Contents'); mk('Applications/NDI Tools/NDI Scan Converter.app');
  fs.writeFileSync(path.join(root, 'Applications/Google Chrome.app/Contents/Info.plist'), 'CFBundleShortVersionString=131.0.6778.86\n');
  fs.writeFileSync(path.join(root, 'Applications/Resolume Arena/Arena.app/Contents/Info.plist'), 'CFBundleShortVersionString=7.21.0\n');
  const w = (n, s) => fs.writeFileSync(path.join(cmd, n), s);
  w('sw_vers', '14.5\n'); w('arm64', 'yes\n'); w('cpu', 'Apple M2\n'); w('tunnel', 'yes\n');
  w('sp_audio', ['Audio:', '', '    Devices:', '', ...(noBlackHole ? [] : ['        BlackHole 2ch:', '', '          Input Channels: 2', '']),
    '        Multi-Output Device:', '', '          Default Output Device: Yes', '          Output Channels: 2', '', '        MacBook Pro Speakers:', '', '          Output Channels: 2', ''].join('\n'));
  w('sp_usb', 'USB:\n    Launch Control XL 3:\n      Product ID: 0x0001\n');
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
    for (const k of ['macOS', 'Google Chrome', 'BlackHole 2ch', 'Multi-Output Device', 'Default output', 'LCXL3 on USB', 'Displays', 'Resolume', 'Capture route NDI Tools', 'Tunnel', 'Pages']) assert.equal(by[k] && by[k].status, 'PASS', `${k}: ${JSON.stringify(by[k])}`);
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

test('mac-check.sh: no tunnel is a FAIL with the ssh step; an unknown option exits 2', () => {
  const c = fakeMac();
  try {
    fs.rmSync(path.join(c.env.MAC_CHECK_FAKE, 'tunnel'));
    const r = spawnSync('sh', [SCRIPT, '--no-open'], { encoding: 'utf8', env: c.env });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^FAIL Tunnel: port 8790 is not open on localhost\. Open the tunnel: ssh -L 8790:localhost:8790 puggie@192\.168\.8\.164$/m);
    assert.equal(spawnSync('sh', [SCRIPT, '--bogus'], { encoding: 'utf8', env: c.env }).status, 2);
  } finally { fs.rmSync(c.d, { recursive: true, force: true }); }
});
