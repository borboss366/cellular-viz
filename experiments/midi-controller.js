// The controller (docs/CELLULAR_VIZ_BRIEF_NOVATION.md D1–D3; docs/LCXL3_MAC_BRIEF.md Job 2): a Novation Launch Control
// XL 3 in DAW mode drives the clock's hand fixes, and its LEDs and display show the clock. Bytes are the ones checked
// on the hardware on 15 Nov (experiments/lcxl3.map.json, notes/lcxl3-hardware-check.md); a node test keeps the
// constants below equal to the map.
//
// Ports: the input and output whose name contains "DAW" (CoreMIDI: "LCXL3 1 DAW Out" / "LCXL3 1 DAW In"). In DAW mode
// the device's standalone MIDI port is silent (hardware check), so Resolume can't read the device while this holds
// DAW mode. The bridge (the orchestrator's decision, 15 Nov): the 8 faders (ch16 CC 5–12) and pot rows 2 and 3 (ch16 CC
// 21–36) go out unchanged on a virtual output, by default the macOS IAC Driver bus (the first output named "IAC"), and
// Resolume listens to that bus only. The page's own controls (both button rows, pot row 1, Shift) never go out. The
// choice of bus is kept by name in storage (localStorage on the page). ctl.bridge: 'off' (no such port), 'on', or
// 'degraded' (the bus is there but the device isn't connected in DAW Mixer / Control, so nothing reaches it).
// Lower button row (D2), ch1 CC 45–52, 7F press / 00 release:
//   tap · flip · ÷2 · ×2 · nudge −10 · nudge +10 · set 1 · restart (fires after a 1 s hold; its LED flashes red while
//   held, a release before 1 s does nothing). ÷2 / ×2 pressed again release the hold (clock.js D4, not here).
// Every press is clock.fix(kind, arg, { origin: 'fix:controller', eventTs }) with the MIDI event's timeStamp (the
// performance.now() clock, as a key's). Upper row (hand-held mode, docs/CELLULAR_VIZ_BRIEF_HOLD.md), ch1 CC 37 and 38:
// button 1 = hold (clock.fix('hold'), a toggle; LED green while held, amber while held and holdSuspect, dark when not
// held), button 2 = auto-hold (opts.toggleAutoHold(origin) when the page keeps the choice, else
// clock.fix('autoHold'); LED green when on, dark when off). The two slot windows (19 Nov; one half of the device per
// slot, the user 20 Nov 15:47): upper buttons 3 / 4 (CC 39 / 40) = slot A previous / next, 7 / 8 (CC 43 / 44) = slot
// B previous / next, each press opts.onSlot('A' | 'B', -1 | 1) (the conductor sends it on the shared clock's channel,
// Clock.publish slot()); no clock fix, no LED. Upper buttons 5 / 6 (CC 41 / 42) are the audition page's previous /
// next (qa/audition.mjs), nothing here; Shift is not used yet; the faders and pot rows 2–3 go to the bridge.
// Pot row 1 (ch16 CC 13–20, absolute 0–127; the fix list, 19 Nov 22:00): the page's own knobs, never bridged. Each
// value is kept in ctl.knobs (8 entries, 0..1 = value / 127, null until that pot moves) and handed to
// opts.onKnob(n 1–8, value, all 8); the conductor publishes them to the scenes on the shared clock (clock.js
// Clock.publish setKnobs, a scene reads clock.knob(n)). Absolute is the device's default for row 1 (hardware check);
// nothing here switches it.
// LEDs (D3), from the page's own read() and trackerState, diffed, at most 20 Hz: the tap button lights in the first
// quarter of each beat, green locked / amber acquiring / red free-run (steady before the first lock: no beats to
// flash on), dark with no tracker. The beat flashes are booked ahead with MIDIOutput.send(bytes, timestamp): Chrome
// slows the timer to ~1 Hz when the window is covered (Resolume in front; seen 15 Nov), so each tick books every beat
// up to twice the longest recent tick gap ahead (150 ms … 1.1 s). A rejected tap flashes it
// red for 0.6 s. Display (SysEx only; without SysEx the LEDs still work): line 1 BPM + state, line 2 confidence +
// the last fix, on the stationary target 35h.
// The Mode button opens the device's Mode Select page: the buttons then pick Custom Modes (ch7 CC30 ≠ 1, 2) and send
// no CCs, and only Mode closes it. On such a report this sets DAW Mixer back (ch7 CC30 1), the lamp says degraded and
// the display "PRESS MODE". Hot-plug: every statechange re-resolves the ports by name; a new output gets DAW mode, the mode query and
// every LED and display line again (the device powers up in standalone mode). stop() (the page's pagehide) cancels the
// display, darkens the LEDs and sends DAW mode off.
// Encoder LEDs (the user, 20 Nov: "highlight the active knobs on the controller"): pot row 1's eight rings show which
// knobs the slot windows' scenes use: slot A's active knobs blue, slot B's orange, the rest dark. ctl.setControls(bySlot)
// takes the conductor's latest controls per slot ({ A: { controls: [{ knob, name }] }, B: ... }, slot.js's controls
// messages); each ring is SysEx F0 00 20 29 02 15 01 53 <cc> R G B F7 (Programmer's Reference v1.0, RGB 0-127), sent
// only when its colour changes: on setControls, on a fresh output (connect, replug) and after the Mode Select page.
// No SysEx, or a send that throws: logged once (opts.log, else console.warn), the knobs and the clock carry on.
//
//   const ctl = MidiController.create({ clock, navigator, lastFix: () => 'tap', onStatus: s => ... });
//   ctl.start()  → Promise; asks requestMIDIAccess({ sysex: true }), else without SysEx, else status 'no-midi'
//   ctl.stop()   → leaves DAW mode (safe to call twice)
//   ctl.status   → 'off' | 'no-midi' | 'no-device' | 'connected' | 'mode-select'; ctl.sysex → boolean
//   ctl.bridge   → 'off' | 'on' | 'degraded' (opts.onBridge(state, portName)); ctl.bridgePort → its name or null
//   ctl.bridgePorts() → the outputs the bridge may use (every output but the device's); ctl.setBridgePort(name)
// Include with <script src="midi-controller.js"></script>; node's tests load it with require.
(function (root) {
  'use strict';

  const BUTTON_CH = 0xB0, FLASH_CH = 0xB1, FEATURE_CH = 0xB6, QUERY_CH = 0xB7;
  const LOWER = [45, 46, 47, 48, 49, 50, 51, 52];
  // the upper row's used buttons (hand-held mode): hold, auto-hold
  const UPPER = [37, 38], HOLD_CC = 37, AUTO_HOLD_CC = 38;
  // the slot windows' buttons, one half of the device per slot (20 Nov): CC -> [slot, dir]; upper 3 / 4 = slot A,
  // 7 / 8 = slot B (upper 5 / 6, CC 41 / 42: the audition page's, not here)
  const SLOT_CCS = { 39: ['A', -1], 40: ['A', 1], 43: ['B', -1], 44: ['B', 1] };
  const COLOUR = { off: 0, red: 5, amber: 9, green: 21 };
  const POT_CH = 0xBF, BRIDGE_CCS = [[5, 12], [21, 36]], BRIDGE_DEFAULT = /IAC/, DEVICE_PORT = /LCXL3/;
  const KNOB_CCS = [13, 20], KNOBS = 8;   // pot row 1: the page's knobs (not bridged)
  const BRIDGE_KEY = 'cellular-viz.lcxl3.bridgePort';
  const DAW_ON = [0x9F, 0x0C, 0x7F], DAW_OFF = [0x9F, 0x0C, 0x00];
  const MODE_CC = 30, MODE_MIXER = 1, MODE_CONTROL = 2;
  const SYSEX = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15], DISPLAY_TARGET = 0x35, DISPLAY_CHARS = 16;
  // the lower row, left to right (D2)
  const ACTIONS = [['tap'], ['flip'], ['half'], ['x2'], ['nudge', -10], ['nudge', 10], ['setOne'], ['restart']];
  const STATE_COLOUR = { locked: COLOUR.green, acquire: COLOUR.amber, 'free-run': COLOUR.red };
  const STATE_TEXT = { locked: 'LOCK', acquire: 'ACQ', 'free-run': 'FREE' };
  // the tap LED is on for the first quarter of a beat
  const BEAT_ON = 0.25, TICK_MS = 50, DISPLAY_MS = 250, REJECT_MS = 600, RESTART_HOLD_MS = 1000;
  const AHEAD_MIN_MS = 150, AHEAD_MAX_MS = 1100, GAPS_KEPT = 8;
  // setting DAW Mixer back is echoed as CC30 1 even while the Mode Select page stays open, so the lamp keeps saying
  // "press MODE" this long after the last report of another mode
  const MODE_SELECT_MS = 3000;

  const ascii = s => [...String(s)].map(c => c.charCodeAt(0)).filter(b => b >= 0x20 && b <= 0x7E).slice(0, DISPLAY_CHARS);
  const displayConfig = cfg => [...SYSEX, 0x04, DISPLAY_TARGET, cfg, 0xF7];
  const displayText = (field, s) => [...SYSEX, 0x06, DISPLAY_TARGET, field, ...ascii(s), 0xF7];
  // the encoder rings (see the header): RGB 0-127 per slot; blue and orange, never a red / green pair
  const KNOB_RGB = { A: [0, 24, 127], B: [127, 40, 0], off: [0, 0, 0] };
  const LED_RGB = 0x53;
  const clamp7 = x => Math.max(0, Math.min(127, Math.round(Number(x) || 0)));
  const encoderLed = (cc, rgb) => [...SYSEX, 0x01, LED_RGB, cc, clamp7(rgb[0]), clamp7(rgb[1]), clamp7(rgb[2]), 0xF7];
  /** the conductor's controls per slot -> pot row 1's 8 colours (index 0 = knob 1): slot A's knobs blue, B's orange */
  function knobColours(bySlot) {
    const out = new Array(KNOBS).fill(KNOB_RGB.off);
    for (const s of ['B', 'A']) {   // A last: a knob both claim shows A's colour
      const c = bySlot && bySlot[s], list = Array.isArray(c) ? c : (c && Array.isArray(c.controls) ? c.controls : []);
      for (const x of list) if (x && Number.isInteger(x.knob) && x.knob >= 1 && x.knob <= KNOBS) out[x.knob - 1] = KNOB_RGB[s];
    }
    return out;
  }

  /** the faders and pot rows 2–3, the controls the bridge passes to Resolume */
  const forwarded = data => !!data && data.length === 3 && data[0] === POT_CH && BRIDGE_CCS.some(([a, b]) => data[1] >= a && data[1] <= b);

  /** one inbound message → { type: 'button', index (0–7 lower row), down } | { type: 'upper', which, down } |
   *  { type: 'knob', index (0–7, pot row 1), value (0..1) } | { type: 'mode', value } | null */
  function decode(data) {
    if (!data || data.length < 3) return null;
    const [st, cc, v] = data;
    if (st === POT_CH && cc >= KNOB_CCS[0] && cc <= KNOB_CCS[1]) return { type: 'knob', index: cc - KNOB_CCS[0], value: Math.max(0, Math.min(127, v)) / 127 };
    if (st === BUTTON_CH && LOWER.includes(cc)) return { type: 'button', index: LOWER.indexOf(cc), down: v > 0 };
    if (st === BUTTON_CH && UPPER.includes(cc)) return { type: 'upper', which: cc === HOLD_CC ? 'hold' : 'autoHold', down: v > 0 };
    if (st === BUTTON_CH && SLOT_CCS[cc]) return { type: 'slot', slot: SLOT_CCS[cc][0], dir: SLOT_CCS[cc][1], down: v > 0 };
    if (st === FEATURE_CH && cc === MODE_CC) return { type: 'mode', value: v };
    return null;
  }

  /**
   * what each lower-row and used upper-row LED shows: { [cc]: [status, cc, index] }; the tap LED is null while it
   * flashes on the beats (booked ahead by the controller, not diffed).
   * view: { playing, state, beats, phase, rejecting, restartHeld, held, holdSuspect, autoHold }
   */
  function leds(view) {
    const out = {};
    for (const cc of [...LOWER, ...UPPER]) out[cc] = [BUTTON_CH, cc, COLOUR.off];
    if (view.held) out[HOLD_CC] = [BUTTON_CH, HOLD_CC, view.holdSuspect ? COLOUR.amber : COLOUR.green];
    if (view.autoHold) out[AUTO_HOLD_CC] = [BUTTON_CH, AUTO_HOLD_CC, COLOUR.green];
    const tap = LOWER[0], restart = LOWER[7];
    if (view.rejecting) out[tap] = [FLASH_CH, tap, COLOUR.red];
    else if (view.playing && STATE_COLOUR[view.state]) out[tap] = view.beats >= 0 ? null : [BUTTON_CH, tap, STATE_COLOUR[view.state]];
    if (view.restartHeld) out[restart] = [FLASH_CH, restart, COLOUR.red];
    return out;
  }

  /** the display's two lines (16 characters each at most) */
  function displayLines(view) {
    if (view.modeSelect) return ['PRESS MODE', 'TO CLOSE MENU'];
    const bpm = view.playing && Number.isFinite(view.bpm) && view.bpm > 0 ? view.bpm.toFixed(1) : '---.-';
    const state = view.playing ? STATE_TEXT[view.state] || 'WAIT' : 'STOP';
    const conf = Number.isFinite(view.confidence) ? Math.round(Math.max(0, Math.min(1, view.confidence)) * 100) : 0;
    return [`${bpm} BPM ${state}`.slice(0, DISPLAY_CHARS), `C${conf}% ${view.lastFix || ''}`.trim().slice(0, DISPLAY_CHARS)];
  }

  function create(opts) {
    const o = opts || {};
    const clock = o.clock, nav = o.navigator || root.navigator;
    const perfNow = o.perfNow || (() => root.performance.now());
    const setI = o.setInterval || ((f, ms) => root.setInterval(f, ms)), clearI = o.clearInterval || (h => root.clearInterval(h));
    const setT = o.setTimeout || ((f, ms) => root.setTimeout(f, ms)), clearT = o.clearTimeout || (h => root.clearTimeout(h));
    const lastFix = o.lastFix || (() => '');
    const storage = o.storage || null;
    let bridgeOut = null, bridgeWant = null;
    try { bridgeWant = storage ? storage.getItem(BRIDGE_KEY) : null; } catch (e) { /* storage blocked: the default bus */ }
    let access = null, input = null, output = null, timer = null, holdTimer = null, stopped = false;
    let knobSent = {}, controls = {}, ledWarned = false;
    const warn = msg => { if (ledWarned) return; ledWarned = true; try { (o.log || (m => root.console && root.console.warn(m)))(msg); } catch (e) { /* never in the way */ } };
    let ledSent = {}, linesSent = [], bookedBeat = null, lastTickAt = null, gaps = [], lastDisplayAt = -1e9, rejectUntil = -1e9, modeSelectUntil = -1e9, restartHeld = false;
    const ctl = { status: 'off', sysex: false, sent: 0, bridge: 'off', bridgePort: null, forwarded: 0, start, stop, tick, bridgePorts, setBridgePort,
      knobs: new Array(KNOBS).fill(null), setControls, ledBatches: 0, ledError: null };

    function setStatus(s) {
      if (ctl.status === s) return;
      ctl.status = s;
      if (o.onStatus) o.onStatus(s);
      bridgeState();
    }
    function bridgeState() {
      const b = !bridgeOut ? 'off' : ctl.status === 'connected' ? 'on' : 'degraded', name = bridgeOut ? bridgeOut.name : null;
      if (ctl.bridge === b && ctl.bridgePort === name) return;
      ctl.bridge = b; ctl.bridgePort = name;
      if (o.onBridge) o.onBridge(b, name);
    }
    function bridgePorts() {
      if (!access) return [];
      return [...access.outputs.values()].filter(p => !DEVICE_PORT.test(p.name || '') && p.state !== 'disconnected').map(p => p.name);
    }
    function setBridgePort(name) {
      bridgeWant = name || null;
      try { if (storage) { if (bridgeWant) storage.setItem(BRIDGE_KEY, bridgeWant); else storage.removeItem(BRIDGE_KEY); } } catch (e) { /* not kept */ }
      resolve();
    }
    // the chosen bus by name, else the first IAC bus; never one of the device's own ports
    function resolveBridge() {
      const ok = [...access.outputs.values()].filter(p => !DEVICE_PORT.test(p.name || '') && p.state !== 'disconnected');
      bridgeOut = (bridgeWant && ok.find(p => p.name === bridgeWant)) || ok.find(p => BRIDGE_DEFAULT.test(p.name || '')) || null;
      bridgeState();
    }
    function send(bytes, at) {
      if (!output) return;
      if (bytes[0] === 0xF0 && !ctl.sysex) return;
      try { if (at === undefined) output.send(bytes); else output.send(bytes, at); ctl.sent++; } catch (e) { /* a port that vanished mid-send: the next statechange resolves it */ }
    }
    // the encoder rings: only the rings whose colour changed; one batch, never per frame. Never throws.
    function knobLeds() {
      if (!output) return 0;
      if (!ctl.sysex) { if (Object.values(controls).some(c => c)) warn('LCXL3: the encoder LEDs need SysEx (allow it for this page); the knobs work without'); return 0; }
      const want = knobColours(controls);
      let n = 0;
      for (let i = 0; i < KNOBS; i++) {
        const cc = KNOB_CCS[0] + i, key = want[i].join(',');
        if (knobSent[cc] === key) continue;
        try { output.send(encoderLed(cc, want[i])); ctl.sent++; knobSent[cc] = key; n++; }
        catch (e) { ctl.ledError = String(e && e.message || e); warn(`LCXL3: encoder LED send failed (${ctl.ledError}); the knobs work without`); return n; }
      }
      if (n) ctl.ledBatches++;
      return n;
    }
    /** the conductor's latest controls per slot ({ A, B }): the active knobs light, the rest go dark */
    function setControls(bySlot) {
      controls = { A: bySlot && bySlot.A ? bySlot.A : null, B: bySlot && bySlot.B ? bySlot.B : null };
      return knobLeds();
    }
    // a fresh output (start, replug): DAW mode, the surface mode asked for, and every LED and line sent again
    function enter() {
      send(DAW_ON);
      send([QUERY_CH, MODE_CC, 0]);
      ledSent = {}; linesSent = []; lastDisplayAt = -1e9; bookedBeat = null; knobSent = {}; ctl.ledError = null;
      if (ctl.sysex) send(displayConfig(0x01));
      knobLeds();
    }
    function fix(kind, arg, eventTs) {
      const j = clock.fix(kind, arg, { origin: 'fix:controller', eventTs });
      if (kind === 'tap' && j && j.rejected) rejectUntil = perfNow() + REJECT_MS;
      return j;
    }
    function onButton(index, down, eventTs) {
      const [kind, arg] = ACTIONS[index];
      if (kind !== 'restart') { if (down) fix(kind, arg, eventTs); return; }
      if (down && !restartHeld) {
        restartHeld = true;
        holdTimer = setT(() => { holdTimer = null; restartHeld = false; fix('restart', undefined, eventTs); }, RESTART_HOLD_MS);
      } else if (!down && restartHeld) {
        restartHeld = false;
        if (holdTimer !== null) { clearT(holdTimer); holdTimer = null; }
      }
    }
    // the upper row: hold (a toggle in the clock) and auto-hold (the page keeps the choice when it gives toggleAutoHold)
    function onUpper(which, down, eventTs) {
      if (!down) return;
      if (which === 'hold') return clock.fix('hold', undefined, { origin: 'fix:controller', eventTs });
      if (o.toggleAutoHold) return o.toggleAutoHold('fix:controller');
      return clock.fix('autoHold', undefined, { origin: 'fix:controller', eventTs });
    }
    function onMessage(e) {
      if (bridgeOut && forwarded(e && e.data)) {
        try { bridgeOut.send([...e.data]); ctl.forwarded++; } catch (err) { bridgeOut = null; bridgeState(); }
        return;
      }
      const m = decode(e && e.data);
      if (!m) return;
      if (m.type === 'button') return onButton(m.index, m.down, e.timeStamp);
      if (m.type === 'upper') return onUpper(m.which, m.down, e.timeStamp);
      if (m.type === 'slot') { if (m.down && o.onSlot) o.onSlot(m.slot, m.dir); return; }   // upper 5-8: the slot windows
      if (m.type === 'knob') {   // pot row 1: kept and handed to the page (the scenes' knobs), never bridged
        ctl.knobs[m.index] = m.value;
        if (o.onKnob) o.onKnob(m.index + 1, m.value, ctl.knobs.slice());
        return;
      }
      // the Mode Select page (or a Custom Mode) took the surface: set DAW Mixer back; the user has to close the page
      if (m.value !== MODE_MIXER && m.value !== MODE_CONTROL) {
        modeSelectUntil = perfNow() + MODE_SELECT_MS;
        setStatus('mode-select');
        send([FEATURE_CH, MODE_CC, MODE_MIXER]);
      }
      ledSent = {}; linesSent = []; knobSent = {};   // the rings go out again on the next tick
    }
    const daw = ports => { for (const p of ports.values()) if (/DAW/.test(p.name || '') && p.state !== 'disconnected') return p; return null; };
    function resolve() {
      if (stopped || !access) return;
      const i = daw(access.inputs), out = daw(access.outputs);
      if (input && input !== i) input.onmidimessage = null;
      if (i && i !== input) i.onmidimessage = onMessage;
      input = i;
      if (!out) { output = null; ledSent = {}; linesSent = []; knobSent = {}; setStatus('no-device'); return resolveBridge(); }
      if (out !== output) { output = out; enter(); }
      if (ctl.status !== 'mode-select') setStatus('connected');
      resolveBridge();
    }

    function view() {
      const playing = !!clock.playing, r = playing ? clock.read() : {}, ts = clock.trackerState || {};
      const h = ts.held || null;
      return { playing, state: ts.state, beats: r.beats, phase: r.phase, bpm: r.bpm, confidence: r.confidence, lastFix: lastFix(),
        rejecting: perfNow() < rejectUntil, restartHeld, modeSelect: ctl.status === 'mode-select',
        held: !!(h && h.on), holdSuspect: !!(h && h.on && h.suspect), autoHold: !!clock.autoHold };
    }
    // the tap LED's flashes, booked on the device's clock for every beat in the look-ahead not booked yet
    function bookBeats(v, now) {
      const period = 60000 / v.bpm, colour = STATE_COLOUR[v.state], base = Math.floor(v.beats), tap = LOWER[0];
      if (!(period > 0)) return;
      if (bookedBeat !== null && base < bookedBeat - 2) bookedBeat = null;   // a restart or a big jump back
      const ahead = Math.min(AHEAD_MAX_MS, Math.max(AHEAD_MIN_MS, 2 * Math.max(0, ...gaps)));
      if (bookedBeat === null && v.phase < BEAT_ON) {   // inside a beat's window already: on now, off at its end
        send([BUTTON_CH, tap, colour]); send([BUTTON_CH, tap, COLOUR.off], now + (BEAT_ON - v.phase) * period);
      }
      if (bookedBeat === null) bookedBeat = base;
      for (let n = 1; (n - v.phase) * period <= ahead; n++) {
        const k = base + n, at = now + (n - v.phase) * period;
        if (k <= bookedBeat) continue;
        send([BUTTON_CH, tap, colour], at); send([BUTTON_CH, tap, COLOUR.off], at + BEAT_ON * period);
        bookedBeat = k;
      }
    }
    // one frame: only what changed goes out; the display at most every DISPLAY_MS
    function tick() {
      if (!output) return;
      const now = perfNow();
      if (lastTickAt !== null) { gaps.push(now - lastTickAt); if (gaps.length > GAPS_KEPT) gaps.shift(); }
      lastTickAt = now;
      if (ctl.status === 'mode-select' && now >= modeSelectUntil) setStatus('connected');
      const v = view(), want = leds(v);
      for (const cc of [...LOWER, ...UPPER]) {
        const m = want[cc];
        if (m === null) {
          if (ledSent[cc] && ledSent[cc].startsWith(String(FLASH_CH))) send([FLASH_CH, cc, COLOUR.off]);
          bookBeats(v, now); ledSent[cc] = 'beats'; continue;
        }
        if (ledSent[cc] === 'beats') bookedBeat = null;
        const key = m.join(',');
        if (ledSent[cc] === key) continue;
        // a flash keeps going under a static colour on some palettes: clear it first (index 0 on the flash channel)
        if (ledSent[cc] && ledSent[cc].startsWith(String(FLASH_CH)) && m[0] !== FLASH_CH) send([FLASH_CH, cc, COLOUR.off]);
        send(m); ledSent[cc] = key;
      }
      if (!ctl.sysex) return;
      if (!ctl.ledError && Object.keys(knobSent).length < KNOBS) knobLeds();   // only after Mode Select cleared them: nothing per frame
      const lines = displayLines(v);
      if (now - lastDisplayAt < DISPLAY_MS || (lines[0] === linesSent[0] && lines[1] === linesSent[1])) return;
      lastDisplayAt = now;
      lines.forEach((s, f) => { if (s !== linesSent[f]) send(displayText(f, s)); });
      send(displayConfig(0x7F));
      linesSent = lines;
    }

    async function start() {
      if (!nav || typeof nav.requestMIDIAccess !== 'function') return setStatus('no-midi');
      try { access = await nav.requestMIDIAccess({ sysex: true }); }
      catch (e) { try { access = await nav.requestMIDIAccess(); } catch (e2) { access = null; } }
      if (stopped) return;
      if (!access) return setStatus('no-midi');
      ctl.sysex = !!access.sysexEnabled;
      access.onstatechange = () => resolve();
      resolve();
      timer = setI(tick, TICK_MS);
    }
    function stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== null) { clearI(timer); timer = null; }
      if (holdTimer !== null) { clearT(holdTimer); holdTimer = null; }
      if (access) access.onstatechange = null;
      if (input) input.onmidimessage = null;
      if (output) {
        if (ctl.sysex) send(displayConfig(0x00));
        for (const cc of LOWER) { send([FLASH_CH, cc, COLOUR.off]); send([BUTTON_CH, cc, COLOUR.off]); }
        for (const cc of UPPER) send([BUTTON_CH, cc, COLOUR.off]);
        if (ctl.sysex) for (let i = 0; i < KNOBS; i++) send(encoderLed(KNOB_CCS[0] + i, KNOB_RGB.off));
        send(DAW_OFF);
      }
      setStatus('off');
      bridgeOut = null; bridgeState();
    }
    return ctl;
  }

  const api = { create, decode, forwarded, leds, displayLines, encoderLed, knobColours,
    MAP: { KNOB_RGB, LED_RGB, SYSEX, LOWER, UPPER, HOLD_CC, AUTO_HOLD_CC, COLOUR, FLASH_CH, BUTTON_CH, FEATURE_CH, QUERY_CH, DAW_ON, DAW_OFF, MODE_CC, DISPLAY_TARGET, ACTIONS, BEAT_ON, RESTART_HOLD_MS, POT_CH, BRIDGE_CCS, BRIDGE_KEY, KNOB_CCS, SLOT_CCS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MidiController = api;
})(typeof window !== 'undefined' ? window : globalThis);
