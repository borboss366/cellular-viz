// Beat sources on the conductor (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 3, first half): experiments/sources.mjs
// (the board: rows side by side, the pick landing on a bar line, lost after 2 s, the log thinning), the page's keys,
// the log schema's 'source' / 'sourcePick' records, and the wiring in clock.js and clock-conductor.html. No browser.
//   node --test qa/runner/test/sources.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../../../experiments/sources.mjs';
import * as C from '../../../experiments/conductor.mjs';
import * as L from '../../conduct-log.mjs';
import * as K from '../../conduct-score.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const msg = (o = {}) => ({ type: 'source', v: 1, id: 'fake', t: 1e6, beats: 20, bpm: 120, confidence: 1, state: 'locked', ...o });

test('sources: beatd messages are checked; ours is the first row; the lamp, the tempo and how far each beat is from the clock', () => {
  assert.deepEqual(S.readSource(msg()), { id: 'fake', t: 1e6, beats: 20, bpm: 120, conf: 1, state: 'locked' });
  for (const bad of [msg({ v: 2 }), msg({ id: 'ours' }), msg({ id: 'bad id' }), msg({ bpm: 0 }), msg({ beats: NaN }), msg({ state: 'happy' }), { type: 'clock' }, null])
    assert.equal(S.readSource(bad), null, JSON.stringify(bad));
  const b = S.createBoard();
  assert.equal(b.ingest(msg({ beats: 20.05 }), 1e6), true);
  assert.equal(b.ingest(msg({ id: 'slow', bpm: 90, beats: 7.5 }), 1e6), true);
  assert.equal(b.ingest(msg({ id: 'ours' }), 1e6), false, 'nobody else is ours');
  // at wall time 1e6 the playing clock is on beat 10.0 at 120 bpm (one beat = 500 ms)
  const rows = b.view(1e6, { clockBeats: 10, clockBpm: 120, ours: { beats: 33.98, bpm: 120.04, conf: 0.9, state: 'locked' } });
  assert.deepEqual(rows.map(r => r.id), ['ours', 'fake', 'slow']);
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  assert.equal(by.ours.picked, true, 'ours is picked until the user picks another');
  assert.equal(by.fake.deltaMs, 25, 'a source 0.05 beat late at 120 bpm is +25 ms');
  assert.equal(by.ours.deltaMs, -10, 'ours 0.02 beat early: -10 ms');
  assert.equal(by.slow.deltaMs, 250, 'half a beat off reads +250 ms (wrapped into the half beat)');
  assert.equal(by.fake.lamp, true); assert.equal(by.slow.lamp, false, 'the lamp is on for the first fifth of each beat');
  assert.equal(by.ours.bpm, 120); assert.equal(by.slow.bpm, 90);
  // 100 ms later the source's beat is extrapolated at its own tempo (0.2 beat at 120), the clock's too: same delta
  assert.ok(Math.abs(b.beatsAt('fake', 1e6 + 100) - 20.25) < 1e-9);
  assert.equal(b.view(1e6 + 100, { clockBeats: 10.2, clockBpm: 120 }).find(r => r.id === 'fake').deltaMs, 25);
  // no clock beats yet: no delta; no ours: a waiting row
  const none = b.view(1e6, {});
  assert.equal(none[0].state, 'waiting'); assert.equal(none[1].deltaMs, null);
  assert.deepEqual(S.rowText(by.fake), { mark: '', id: 'fake', lamp: '#', bpm: '120.0', conf: '1.00', delta: '+25 ms', state: 'locked' });
  assert.equal(S.rowText(by.ours).mark, '*');
});

test('sources: the pick steps through the sources and lands only when asked (the page: on the next bar line); lost after 2 s; the log every 250 ms and on a change', () => {
  const b = S.createBoard();
  b.ingest(msg(), 0); b.ingest(msg({ id: 'b' }), 0);
  assert.equal(b.step(1), 'fake'); assert.equal(b.picked, 'ours', 'nothing changes before the bar line');
  assert.equal(b.step(1), 'b', 'a second press moves the pending pick on');
  assert.equal(b.step(1), null, 'round to ours again: nothing pending');
  assert.equal(b.step(-1), 'b', 'previous wraps to the last');
  assert.deepEqual(b.land(), { from: 'ours', to: 'b' }); assert.equal(b.picked, 'b'); assert.equal(b.land(), null);
  assert.equal(b.view(0, {}).find(r => r.id === 'b').picked, true);
  assert.equal(b.pick('nope'), null); assert.equal(b.pick('ours'), 'ours'); assert.equal(b.view(0, {})[0].pending, true);
  // lost: 2 s without a message
  assert.deepEqual(b.lostNow(1999), []);
  assert.deepEqual(b.lostNow(2001), ['fake', 'b']); assert.deepEqual(b.lostNow(3000), [], 'once');
  assert.equal(b.view(2001, { clockBeats: 1, clockBpm: 120 }).find(r => r.id === 'fake').state, 'lost');
  assert.equal(b.view(2001, { clockBeats: 1, clockBpm: 120 }).find(r => r.id === 'fake').deltaMs, null);
  b.ingest(msg({ t: 3000 }), 3000);
  assert.equal(b.view(3000, {}).find(r => r.id === 'fake').state, 'locked', 'back when it speaks again');
  // the log: the first message, then not before 250 ms, but at once on a state change
  const c = S.createBoard();
  c.ingest(msg({ t: 0 }), 0);
  assert.deepEqual(c.logRecord('fake', 0), { id: 'fake', t: 0, beats: 20, bpm: 120, conf: 1, state: 'locked' });
  c.ingest(msg({ t: 50 }), 50); assert.equal(c.logRecord('fake', 50), null);
  c.ingest(msg({ t: 260 }), 260); assert.equal(c.logRecord('fake', 260).t, 260);
  c.ingest(msg({ t: 300, state: 'free-run' }), 300); assert.equal(c.logRecord('fake', 300).state, 'free-run');
  c.lostNow(5000); assert.equal(c.logRecord('fake', 5000).state, 'lost');
  assert.equal(c.logRecord('nope', 0), null);
});

test('sources on the page: Shift+O / Shift+P pick (Shift+, and Shift+. stay the clock\'s nudges); the log takes source and sourcePick; clock.js hands source messages to the page; the panel is wired', () => {
  const k = (code, mods = {}) => C.pageKey({ code, target: { tagName: 'BODY' }, ...mods });
  assert.deepEqual(k('KeyO', { shiftKey: true }), { type: 'source', dir: -1 });
  assert.deepEqual(k('KeyP', { shiftKey: true }), { type: 'source', dir: 1 });
  assert.equal(k('KeyO'), null); assert.equal(k('Comma', { shiftKey: true }), null);
  const clockJs = fs.readFileSync(path.join(REPO, 'experiments', 'clock.js'), 'utf8');
  assert.doesNotMatch(clockJs.match(/FIX_KEYS[\s\S]{0,600}/)[0], /KeyO|KeyP/, 'Shift+O / P are free in the clock');
  assert.match(clockJs, /m\.type === 'source' && typeof pub\.onSource === 'function'\) pub\.onSource\(m\)/);
  // the log schema (v3 additions): both records pass the server's check
  assert.ok(L.TYPES.includes('source') && L.TYPES.includes('sourcePick'));
  assert.deepEqual(K.checkRecord({ type: 'source', ctx: 1, id: 'fake', t: 1e6, beats: 2, bpm: 120, conf: 1, state: 'locked' }), []);
  assert.deepEqual(K.checkRecord({ type: 'sourcePick', ctx: 1, id: 'fake', from: 'ours', origin: 'key' }), []);
  assert.notDeepEqual(K.checkRecord({ type: 'source', ctx: 1, id: 'fake' }), []);
  const log = new L.ConductLog({ id: 'conductor-20261127-090000', now: () => 2 });
  log.add('source', { id: 'fake', t: 1e6, beats: 2, bpm: 120, conf: 1, state: 'locked' });
  log.add('sourcePick', { id: 'fake', from: 'ours', origin: 'key' });
  assert.deepEqual(log.all.slice(-2).map(r => r.type), ['source', 'sourcePick']);
  // the page
  const html = fs.readFileSync(path.join(REPO, 'experiments', 'clock-conductor.html'), 'utf8');
  assert.match(html, /import \{ createBoard, rowText \} from '\.\/sources\.mjs';/);
  assert.match(html, /publisher\.onSource = m => \{/);
  assert.match(html, /log\.add\('source', rec\)/); assert.match(html, /log\.add\('sourcePick', \{ id: l\.to, from: l\.from/);
  assert.match(html, /drawSources\(now\);/);
  assert.match(html, /else if \(a\.type === 'source'\) pickSource\(a\.dir, 'key'\);/);
  assert.match(html, /<table id="sources" class="sources">/);
  assert.match(html, /Shift\+O and Shift\+P select the previous and the next source/, 'the Help panel says it');
});
