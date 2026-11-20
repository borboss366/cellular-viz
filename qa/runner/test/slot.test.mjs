// The slot windows (slot.html + slot.js; the user, 19 Nov 23:01: "start with two windows"). No browser here: a fake
// document and fake scene frames drive SlotLib.create; slot.html, set.html's "Open slots" and the conductor's wiring
// are checked in their source (set.html's inline script runs with a fake window, as in scene-set.test.mjs). The real
// iframes, the shared clock and 40 switches run on the box in slot-smoke.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../experiments');
const SetLib = require(path.join(EX, 'set.js'));
const SlotLib = require(path.join(EX, 'slot.js'));
const SET = JSON.parse(fs.readFileSync(path.join(EX, 'set.json'), 'utf8'));

// ---------- a fake document, fake scene frames, fake timers ----------
function el(tag) {
  const e = { tagName: tag.toUpperCase(), attrs: {}, listeners: {}, children: [], parentNode: null, className: '', src: '', classes: new Set(), removed: false,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, removeEventListener() {},
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); this.parentNode = null; this.removed = true; },
    querySelectorAll(sel) { return sel === 'iframe' ? this.children.filter(c => c.tagName === 'IFRAME') : []; },
    fire(t, ev) { for (const f of this.listeners[t] || []) f(ev || {}); } };
  e.classList = { toggle(c, on) { if (on) e.classes.add(c); else e.classes.delete(c); }, contains: c => e.classes.has(c), add: c => e.classes.add(c), remove: c => e.classes.delete(c) };
  return e;
}
function world(o = {}) {
  const stage = el('div'), cover = el('div'); cover.classes.add('on');
  const doc = { title: '', body: stage, getElementById: id => ({ stage, cover }[id] || null), createElement: el };
  let t = 0, seq = 0;
  const timers = new Map();
  const add = (f, ms, every) => { const id = ++seq; timers.set(id, { f, at: t + ms, every: every ? ms : 0 }); return id; };
  const advance = ms => {
    const end = t + ms;
    for (;;) {
      let next = null;
      for (const [id, tm] of timers) if (tm.at <= end && (!next || tm.at < next[1].at)) next = [id, tm];
      if (!next) break;
      t = next[1].at;
      if (next[1].every) next[1].at += next[1].every; else timers.delete(next[0]);
      next[1].f();
    }
    t = end;
  };
  const win = el('window');
  const posted = [];
  const channel = { onmessage: null, postMessage: m => posted.push(m) };
  const s = SlotLib.create({ SetLib, doc, win, set: o.set || SET, slot: o.slot || 'A', start: o.start, inLabel: o.inLabel, channel,
    now: () => t, setTimeout: (f, ms) => add(f, ms, false), clearTimeout: id => timers.delete(id),
    setInterval: (f, ms) => add(f, ms, true), clearInterval: id => timers.delete(id) });
  // the scene in the current frame loads: a fake window whose shared clock is waiting (or locked)
  const load = (state = 'waiting') => {
    const f = s.frame, gl = { lost: 0, getExtension: n => (n === 'WEBGL_lose_context' ? { loseContext: () => { gl.lost++; } } : null) };
    const canvas = { getContext: type => (type === 'webgl2' ? gl : null) };
    const w = el('window');
    Object.assign(w, { location: { href: f.src }, __qa: { sharedClock: { state } }, panicSet: [], __panic: { set(m) { w.panicSet.push(m); } },
      focused: false, focus() { this.focused = true; }, gl,
      document: { addEventListener() {}, removeEventListener() {}, getElementById: id => (id === 'c' ? canvas : null) } });
    f.contentWindow = w;
    f.fire('load');
    return w;
  };
  const send = msg => channel.onmessage({ data: msg });
  return { s, stage, cover, doc, win, load, send, advance, posted, now: () => t };
}
const coverOn = W => W.cover.classes.has('on');

// ---------- tests ----------
test('slot.js: the slot name, the start scene (A 1, B 2, ?scene=N), stepping with wrap, the command and the keys', () => {
  assert.equal(SlotLib.parseSlot('?slot=B'), 'B'); assert.equal(SlotLib.parseSlot('?slot=b&in=x'), 'B');
  assert.equal(SlotLib.parseSlot(''), 'A'); assert.equal(SlotLib.parseSlot('?slot=C'), 'A');
  assert.equal(SlotLib.startIndex('A', '', 4), 0); assert.equal(SlotLib.startIndex('B', '', 4), 1);
  assert.equal(SlotLib.startIndex('A', '?scene=3', 4), 2); assert.equal(SlotLib.startIndex('B', '?scene=6', 4), 1, 'wraps');
  assert.equal(SlotLib.startIndex('B', '', 1), 0, 'a one-scene set');
  assert.deepEqual([SlotLib.step(0, -1, 4), SlotLib.step(3, 1, 4), SlotLib.step(1, 1, 4)], [3, 0, 2]);
  assert.equal(SlotLib.slotCommand({ type: 'slot', v: 1, slot: 'A', dir: 1 }, 'A'), 1);
  assert.equal(SlotLib.slotCommand({ type: 'slot', v: 1, slot: 'A', dir: -1 }, 'A'), -1);
  for (const m of [{ type: 'slot', slot: 'B', dir: 1 }, { type: 'slot', slot: 'A', dir: 2 }, { type: 'clock', slot: 'A', dir: 1 }, null, 'x'])
    assert.equal(SlotLib.slotCommand(m, 'A'), 0, JSON.stringify(m));
  assert.deepEqual(['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'b', '[', 'z'].map(key => SlotLib.keyDir({ key })), [-1, 1, -1, 1, 0, 0, 0]);
  for (const mod of ['shiftKey', 'ctrlKey', 'metaKey', 'altKey', 'repeat']) assert.equal(SlotLib.keyDir({ key: 'ArrowRight', [mod]: true }), 0, mod);
  assert.equal(SlotLib.keyDir({ key: 'ArrowRight', target: { tagName: 'INPUT', type: 'text' } }), 0, 'not while typing');
  // set.js: the slot windows' URLs and names
  assert.deepEqual(SetLib.SLOTS, ['A', 'B']);
  assert.equal(SetLib.slotUrl('A'), 'slot.html?slot=A');
  assert.equal(SetLib.slotUrl('B', 'USB Audio'), 'slot.html?slot=B&in=USB%20Audio');
  assert.notEqual(SetLib.slotWindowName('A'), SetLib.slotWindowName('B'));
});

test('slot: one scene of set.json in an iframe (its own URL, allow autoplay); the cover stays black until its clock is locked', () => {
  const W = world();
  const sw = W.s.show(W.s.qa.index);
  assert.equal(W.s.qa.index, 0);
  assert.equal(W.stage.children.length, 1);
  const f = W.stage.children[0];
  assert.equal(f.tagName, 'IFRAME');
  assert.equal(f.src, SetLib.buildUrl(SET, SET.scenes[0]), 'the scene URL as set.html builds it: defaults, the scene query');
  assert.match(f.src, /[?&]clock=shared(&|$)/); assert.match(f.src, /[?&]capture=1(&|$)/);
  assert.equal(f.attrs.allow, 'autoplay; microphone');
  assert.equal(W.doc.title, 'slot A');
  assert.ok(coverOn(W), 'black while loading');
  const w = W.load('waiting');
  assert.ok(w.focused, 'the scene gets the focus');
  assert.ok(coverOn(W), 'still black: the clock is not locked yet');
  W.advance(200);
  assert.ok(coverOn(W));
  w.__qa.sharedClock.state = 'locked';
  W.advance(60);
  assert.ok(!coverOn(W), 'the cover comes down once the scene is locked');
  assert.equal(W.s.qa.loading, false);
  assert.ok(sw.lockedAt >= 200 && sw.lockedAt <= 260, `shown within one 50 ms poll of the lock: ${sw.lockedAt}`);
  // the scene with its own query: in=<label> over set.json's, and a scene query kept (24: beatFx=0)
  const P = world({ inLabel: 'USB Audio' }), k = SET.scenes.findIndex(s => s.page === '24-paint-pour.html');
  P.s.show(k);
  assert.match(P.stage.children[0].src, /in=USB%20Audio/);
  assert.match(P.stage.children[0].src, /beatFx=0/);
});

test('slot: a command for this slot switches at once (black first), the old frame is torn down; the other slot is ignored; it wraps', () => {
  const W = world();
  W.s.show(0); const w0 = W.load('locked');
  const old = W.stage.children[0];
  assert.ok(!coverOn(W));
  W.send({ type: 'slot', v: 1, t: 1, slot: 'B', dir: 1 });
  assert.equal(W.s.qa.index, 0, 'slot B\'s command does nothing in slot A');
  assert.equal(W.stage.children[0], old);
  W.send({ type: 'slot', v: 1, t: 2, slot: 'A', dir: 1 });
  assert.equal(W.s.qa.index, 1);
  assert.ok(coverOn(W), 'black at once');
  assert.ok(old.removed && old.src === 'about:blank', 'the old scene is gone');
  assert.equal(w0.gl.lost, 1, 'its WebGL context was lost first (no pile-up over many switches)');
  assert.equal(W.stage.children.length, 1, 'one frame at a time');
  assert.equal(W.stage.children[0].src, SetLib.buildUrl(SET, SET.scenes[1]));
  W.load('locked');
  assert.ok(!coverOn(W));
  W.send({ type: 'slot', v: 1, slot: 'A', dir: -1 }); W.load('locked');
  W.send({ type: 'slot', v: 1, slot: 'A', dir: -1 }); W.load('locked');
  assert.equal(W.s.qa.index, SET.scenes.length - 1, 'previous from the first wraps to the last');
  W.send({ type: 'slot', v: 1, slot: 'A', dir: 2 });
  assert.equal(W.s.qa.index, SET.scenes.length - 1, 'a bad dir is ignored');
  assert.equal(W.s.qa.switches.length, 4);
  assert.equal(W.s.qa.loads, 4);
  // slot B starts on scene 2 and follows only B
  const B = world({ slot: 'B', start: SlotLib.startIndex('B', '', SET.scenes.length) });
  B.s.show(B.s.qa.index);
  assert.equal(B.s.qa.index, 1); assert.equal(B.doc.title, 'slot B');
  B.send({ type: 'slot', v: 1, slot: 'A', dir: 1 }); assert.equal(B.s.qa.index, 1);
  B.send({ type: 'slot', v: 1, slot: 'B', dir: 1 }); assert.equal(B.s.qa.index, 2);
});

test('slot: the panic state is kept: a blackout keeps the cover black across a switch and reaches the new scene; clear lifts it', () => {
  const W = world();
  W.s.show(0); W.load('locked');
  W.send({ type: 'panic', v: 1, mode: 'blackout' });
  assert.ok(coverOn(W), 'blackout: black');
  assert.equal(W.s.qa.panicMode, 'blackout');
  W.send({ type: 'slot', v: 1, slot: 'A', dir: 1 });
  const w1 = W.load('locked');
  assert.deepEqual(w1.panicSet, ['blackout'], 'the new scene is told at once');
  assert.ok(coverOn(W), 'still black after the new scene locked');
  W.send({ type: 'panic', v: 1, mode: 'clear' });
  assert.ok(!coverOn(W), 'clear: the scene shows');
  // calm: the scene's own panic overlay (not the cover); a new scene gets it too
  W.send({ type: 'panic', v: 1, mode: 'calm' });
  assert.ok(!coverOn(W));
  W.send({ type: 'slot', v: 1, slot: 'A', dir: 1 });
  const w2 = W.load('locked');
  assert.deepEqual(w2.panicSet, ['calm']);
  assert.ok(!coverOn(W));
  // clear during a load does not lift the cover early
  W.send({ type: 'slot', v: 1, slot: 'A', dir: 1 });
  W.send({ type: 'panic', v: 1, mode: 'clear' });
  assert.ok(coverOn(W), 'still loading: still black');
});

test('slot: the arrow keys (and Page Up / Down) switch, also from inside the scene\'s frame; modifiers and other keys do not', () => {
  const W = world();
  W.s.show(0);
  const w = W.load('locked');
  const key = (target, k, extra = {}) => { const e = { key: k, preventDefault() { e.prevented = true; }, stopPropagation() {}, ...extra }; target.fire('keydown', e); return e; };
  const e1 = key(w, 'ArrowRight');
  assert.equal(W.s.qa.index, 1, 'a key in the scene\'s frame');
  assert.ok(e1.prevented);
  W.load('locked');
  key(W.win, 'ArrowLeft');
  assert.equal(W.s.qa.index, 0, 'a key in the slot window');
  W.load('locked');
  key(W.win, 'PageDown'); W.load('locked');
  assert.equal(W.s.qa.index, 1);
  for (const [k, x] of [['ArrowRight', { shiftKey: true }], ['b', {}], ['ArrowRight', { repeat: true }]]) key(W.win, k, x);
  assert.equal(W.s.qa.index, 1, 'Shift, other keys and repeats move nothing');
});

test('slot: a scene that never locks shows after 2.5 s (timeout logged); a late load event of an old frame changes nothing', () => {
  const W = world();
  W.s.show(0);
  W.load('waiting');
  W.advance(SlotLib.READY_MS + 10);
  assert.ok(!coverOn(W), 'shown anyway');
  assert.equal(W.s.qa.switches[0].timeout, true);
  const old = W.stage.children[0];
  W.send({ type: 'slot', v: 1, slot: 'A', dir: 1 });
  old.fire('load');   // the old frame going to about:blank
  assert.ok(coverOn(W), 'the new scene is still loading');
  assert.equal(W.s.qa.loads, 1);
  W.load('locked');
  assert.ok(!coverOn(W));
  assert.equal(W.s.qa.loads, 2);
});

// the knobs per slot (the user, 20 Nov 15:34): set.json numbers each scene's knobs 1-4; slot B adds 4
test('slot.js knobs per slot: the *Knob params as this slot\'s knob numbers (A as written, B + 4) and the controls list', () => {
  const by = page => SET.scenes.find(s => s.page === page);
  const hodge = by('16-hodge-kaleidoscope.html'), pour = by('24-paint-pour.html'), eq = by('27-eq-calibrate.html'), bang = by('18-little-bang.html');
  assert.deepEqual(SlotLib.KNOB_OFFSET, { A: 0, B: 4 }); assert.equal(SlotLib.SLOT_KNOBS, 4);
  assert.deepEqual(SlotLib.slotKnobs(SET, hodge, 'A'), { beatKnob: '1', diveKnob: '2', glintKnob: '3' });
  assert.deepEqual(SlotLib.slotKnobs(SET, hodge, 'B'), { beatKnob: '5', diveKnob: '6', glintKnob: '7' });
  assert.deepEqual(SlotLib.controls(SET, hodge, 'A'), [{ knob: 1, name: 'beat' }, { knob: 2, name: 'dive' }, { knob: 3, name: 'glint' }]);
  assert.deepEqual(SlotLib.controls(SET, pour, 'B'), [{ knob: 5, name: 'beat' }, { knob: 6, name: 'pulse' }], 'beatFx is not a knob');
  assert.deepEqual(SlotLib.controls(SET, bang, 'B'), [{ knob: 5, name: 'beat' }, { knob: 6, name: 'speed' }]);
  assert.deepEqual(SlotLib.controls(SET, eq, 'A'), [], '27 EQ: no beat knob (null removes the default)');
  // every scene of the set: slot A's knobs are 1-4, slot B's 5-8, and each scene has the beat on the first (but 27)
  for (const sc of SET.scenes) {
    const a = SlotLib.controls(SET, sc, 'A'), b = SlotLib.controls(SET, sc, 'B');
    assert.ok(a.every(c => c.knob >= 1 && c.knob <= 4) && b.every(c => c.knob >= 5 && c.knob <= 8), sc.page);
    assert.deepEqual(b, a.map(c => ({ knob: c.knob + 4, name: c.name })), sc.page);
    if (sc !== eq) assert.deepEqual(a[0], { knob: 1, name: 'beat' }, sc.page);
  }
  // a number outside 1-4 is kept as written; other params are not knobs
  const odd = { version: 1, scenes: [{ page: '13-flow-lab.html', query: { fooKnob: '7', Knob: '1', speed: '2', barKnob: 'x' } }] };
  assert.deepEqual(SlotLib.slotKnobs(odd, odd.scenes[0], 'B'), { fooKnob: '7', barKnob: 'x' });
  assert.deepEqual(SlotLib.controls(odd, odd.scenes[0], 'B'), [{ knob: 7, name: 'foo' }]);
});

test('slot B\'s scene gets knobs 5-8 in its URL (slot A and "Open all scenes" as written); each switch and a controls-ask send the scene\'s controls', () => {
  const hodge = SET.scenes.findIndex(s => s.page === '16-hodge-kaleidoscope.html');
  const A = world();
  A.s.show(hodge);
  assert.equal(A.stage.children[0].src, SetLib.buildUrl(SET, SET.scenes[hodge]), 'slot A: the URL as set.html builds it');
  assert.match(A.stage.children[0].src, /[?&]beatKnob=1&diveKnob=2&glintKnob=3(&|$)/);
  assert.deepEqual(A.posted, [{ type: 'controls', v: 1, slot: 'A', scene: 'Hodge Kaleidoscope', controls: [{ knob: 1, name: 'beat' }, { knob: 2, name: 'dive' }, { knob: 3, name: 'glint' }] }]);
  const B = world({ slot: 'B', inLabel: 'USB Audio' });
  B.s.show(hodge);
  const src = B.stage.children[0].src;
  assert.match(src, /[?&]beatKnob=5&diveKnob=6&glintKnob=7(&|$)/, src);
  assert.match(src, /[?&]in=USB%20Audio(&|$)/); assert.match(src, /[?&]capture=1(&|$)/);
  assert.equal(src, SetLib.buildUrl(SET, SET.scenes[hodge], { beatKnob: '5', diveKnob: '6', glintKnob: '7', in: 'USB Audio' }));
  assert.deepEqual(B.posted[0].controls, [{ knob: 5, name: 'beat' }, { knob: 6, name: 'dive' }, { knob: 7, name: 'glint' }]);
  assert.equal(B.posted[0].slot, 'B');
  // a switch sends the new scene's controls; the conductor's ask gets them again; other messages send nothing
  B.send({ type: 'slot', v: 1, slot: 'B', dir: 1 });
  assert.equal(B.posted.length, 2);
  assert.equal(B.posted[1].scene, SET.scenes[(hodge + 1) % SET.scenes.length].name);
  B.send({ type: 'controls-ask', v: 1 });
  assert.equal(B.posted.length, 3); assert.deepEqual(B.posted[2], B.posted[1]);
  B.send({ type: 'clock', v: 1 }); B.send({ type: 'controls', v: 1, slot: 'A', controls: [] });
  assert.equal(B.posted.length, 3, 'its own kind of message is not answered');
  assert.equal(B.s.qa.controlsSent, 3);
  assert.deepEqual(B.s.qa.controls, B.posted[2].controls);
  // a channel without postMessage (or none): nothing breaks
  const quiet = SlotLib.create({ SetLib, doc: { title: '', body: { appendChild() {}, querySelectorAll: () => [] }, getElementById: () => null,
    createElement: () => ({ setAttribute() {}, addEventListener() {} }) }, set: SET, slot: 'B', channel: { onmessage: null },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} });
  quiet.show(0);
  assert.equal(quiet.qa.controlsSent, 0);
});

test('slot.html, the conductor and the controller wiring; plain ASCII (#205)', () => {
  const html = fs.readFileSync(path.join(EX, 'slot.html'), 'utf8');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(html), 'slot.html is plain ASCII');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(fs.readFileSync(path.join(EX, 'slot.js'), 'utf8')), 'slot.js is plain ASCII');
  assert.match(html, /<script src="set\.js"><\/script>\s*<script src="slot\.js"><\/script>/);
  assert.match(html, /fetch\('set\.json', \{ cache: 'no-store' \}\)/);
  assert.match(html, /new BroadcastChannel\('cellular-viz-clock'\)/);
  assert.match(html, /SlotLib\.create\(\{ doc: document, win: window, set, slot: slotName, start: SlotLib\.startIndex\(slotName, search, set\.scenes\.length\)/);
  assert.match(html, /<div id="cover" class="on"><\/div>/, 'black from the start');
  assert.match(html, /cursor: none/);
  const cond = fs.readFileSync(path.join(EX, 'clock-conductor.html'), 'utf8');
  assert.match(cond, /function onSlot\(slot, dir\) \{\s*publisher\.slot\(slot, dir\);/);
  assert.match(cond, /toggleAutoHold, onKnob, onSlot,/);
  const Clock = require(path.join(EX, 'clock.js'));
  const sent = [];
  const pub = Clock.publish({ jumps: [], ctx: null, playing: false }, { timers: false, post: m => sent.push(m), epochNow: () => 42 });
  assert.deepEqual(pub.slot('A', 1), { type: 'slot', v: 1, t: 42, slot: 'A', dir: 1 });
  assert.deepEqual(pub.slot('B', -1), { type: 'slot', v: 1, t: 42, slot: 'B', dir: -1 });
  for (const [s, d] of [['C', 1], ['A', 0], ['A', 2], [null, 1]]) assert.equal(pub.slot(s, d), null, `${s} ${d}`);
  assert.equal(sent.length, 2); assert.equal(pub.slots, 2);
  assert.equal(require(path.join(EX, 'panic.js')).panicMode(sent[0]), null, 'panic.js ignores a slot message');
});

test('set.html: "Open slots" opens slot A and slot B (the input label passed) on the two-window diagonal; "Open all scenes" unchanged', async () => {
  const html = fs.readFileSync(path.join(EX, 'set.html'), 'utf8');
  assert.match(html, /<button id="openAll">Open all scenes<\/button> <button id="openSlots"/);
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.equal(inline.length, 1);
  const els = {}, el2 = id => (els[id] = els[id] || { id, value: undefined, textContent: '', onclick: null, oninput: null, children: [], appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); } });
  const opened = [];
  const win = {
    document: { getElementById: el2, createElement: tag => ({ tag, textContent: '', className: '', onclick: null, children: [], appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); } }) },
    fetch: async () => ({ ok: true, json: async () => SET }),
    open: (url, name, features) => { opened.push({ url, name, features }); return {}; },
    location: { search: '?in=USB%20Audio' },
    screen: { availLeft: 0, availTop: 38, availWidth: 1728, availHeight: 1079 },
  };
  win.window = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(EX, 'set.js'), 'utf8'), ctx);
  vm.runInContext(inline[0], ctx);
  await new Promise(r => setImmediate(r));
  el2('openSlots').onclick();
  assert.deepEqual(opened.map(o => o.url), ['slot.html?slot=A&in=USB%20Audio', 'slot.html?slot=B&in=USB%20Audio']);
  assert.deepEqual(opened.map(o => o.name), ['cellular-viz-slot-A', 'cellular-viz-slot-B']);
  assert.deepEqual(opened.map(o => o.features.replace(/^.*left=/, 'left=')), ['left=0,top=38', 'left=768,top=514'], 'two windows on the diagonal');
  el2('openAll').onclick();
  assert.equal(opened.length, 2 + SET.scenes.length, '"Open all scenes" still opens every scene');
  assert.ok(opened.slice(2).every(o => /^\d{2}-[a-z0-9-]+\.html\?/.test(o.url)));
});
