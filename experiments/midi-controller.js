// The controller (docs/CELLULAR_VIZ_BRIEF_NOVATION.md D1–D3; docs/LCXL3_MAC_BRIEF.md Job 2): a Novation Launch Control
// XL 3 in DAW mode drives the clock's hand fixes, and its LEDs and display show the clock. Bytes are the ones checked
// on the hardware on 15 Nov (experiments/lcxl3.map.json, notes/lcxl3-hardware-check.md); a node test keeps the
// constants below equal to the map.
//
// Ports: the input and output whose name contains "DAW" (CoreMIDI: "LCXL3 1 DAW Out" / "LCXL3 1 DAW In"). In DAW mode
// the device's standalone MIDI port is silent (hardware check), so Resolume cannot share the controls while this
// holds DAW mode.
// Lower button row (D2), ch1 CC 45–52, 7F press / 00 release:
//   tap · flip · ÷2 · ×2 · nudge −10 · nudge +10 · set 1 · restart (fires after a 1 s hold; its LED flashes red while
//   held, a release before 1 s does nothing). ÷2 / ×2 pressed again release the hold (clock.js D4, not here).
// Every press is clock.fix(kind, arg, { origin: 'fix:controller', eventTs }) with the MIDI event's timeStamp (the
// performance.now() clock, as a key's). The upper row, the pots and the faders are not read (D2: Resolume's, later).
// LEDs (D3), from the page's own read() and trackerState, diffed, at most 20 Hz: the tap button lights in the first
// quarter of each beat, green locked / amber acquiring / red free-run (steady before the first lock: no beats to
// flash on), dark with no tracker. The beat flashes are booked ahead with MIDIOutput.send(bytes, timestamp): Chrome
// slows the timer to ~1 Hz when the window is covered (Resolume in front; seen 15 Nov), so each tick books every beat
// up to twice the longest recent tick gap ahead (150 ms … 1.1 s). A rejected tap flashes it
// red for 0.6 s. Display (SysEx only; without SysEx the LEDs still work): line 1 BPM + state, line 2 confidence +
// the last fix, on the stationary target 35h.
// The Mode button opens the device's Mode Select page: the buttons then pick Custom Modes (ch7 CC30 ≠ 1, 2) and send
// no CCs, and only Mode closes it. On such a report this sets DAW Mixer back (ch7 CC30 1) and the lamp says "press
// MODE". Hot-plug: every statechange re-resolves the ports by name; a new output gets DAW mode, the mode query and
// every LED and display line again (the device powers up in standalone mode). stop() (the page's pagehide) cancels the
// display, darkens the LEDs and sends DAW mode off.
//
//   const ctl = MidiController.create({ clock, navigator, lastFix: () => 'tap', onStatus: s => ... });
//   ctl.start()  → Promise; asks requestMIDIAccess({ sysex: true }), else without SysEx, else status 'no-midi'
//   ctl.stop()   → leaves DAW mode (safe to call twice)
//   ctl.status   → 'off' | 'no-midi' | 'no-device' | 'connected' | 'mode-select'; ctl.sysex → boolean
// Include with <script src="midi-controller.js"></script>; node's tests load it with require.
(function (root) {
  'use strict';

  const BUTTON_CH = 0xB0, FLASH_CH = 0xB1, FEATURE_CH = 0xB6, QUERY_CH = 0xB7;
  const LOWER = [45, 46, 47, 48, 49, 50, 51, 52];
  const COLOUR = { off: 0, red: 5, amber: 9, green: 21 };
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

  /** one inbound message → { type: 'button', index (0–7 lower row), down } | { type: 'mode', value } | null */
  function decode(data) {
    if (!data || data.length < 3) return null;
    const [st, cc, v] = data;
    if (st === BUTTON_CH && LOWER.includes(cc)) return { type: 'button', index: LOWER.indexOf(cc), down: v > 0 };
    if (st === FEATURE_CH && cc === MODE_CC) return { type: 'mode', value: v };
    return null;
  }

  /**
   * what each lower-row LED shows: { [cc]: [status, cc, index] }; the tap LED is null while it flashes on the beats
   * (booked ahead by the controller, not diffed). view: { playing, state, beats, phase, rejecting, restartHeld }
   */
  function leds(view) {
    const out = {};
    for (const cc of LOWER) out[cc] = [BUTTON_CH, cc, COLOUR.off];
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
    let access = null, input = null, output = null, timer = null, holdTimer = null, stopped = false;
    let ledSent = {}, linesSent = [], bookedBeat = null, lastTickAt = null, gaps = [], lastDisplayAt = -1e9, rejectUntil = -1e9, modeSelectUntil = -1e9, restartHeld = false;
    const ctl = { status: 'off', sysex: false, sent: 0, start, stop, tick };

    function setStatus(s) {
      if (ctl.status === s) return;
      ctl.status = s;
      if (o.onStatus) o.onStatus(s);
    }
    function send(bytes, at) {
      if (!output) return;
      if (bytes[0] === 0xF0 && !ctl.sysex) return;
      try { if (at === undefined) output.send(bytes); else output.send(bytes, at); ctl.sent++; } catch (e) { /* a port that vanished mid-send: the next statechange resolves it */ }
    }
    // a fresh output (start, replug): DAW mode, the surface mode asked for, and every LED and line sent again
    function enter() {
      send(DAW_ON);
      send([QUERY_CH, MODE_CC, 0]);
      ledSent = {}; linesSent = []; lastDisplayAt = -1e9; bookedBeat = null;
      if (ctl.sysex) send(displayConfig(0x01));
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
    function onMessage(e) {
      const m = decode(e && e.data);
      if (!m) return;
      if (m.type === 'button') return onButton(m.index, m.down, e.timeStamp);
      // the Mode Select page (or a Custom Mode) took the surface: set DAW Mixer back; the user has to close the page
      if (m.value !== MODE_MIXER && m.value !== MODE_CONTROL) {
        modeSelectUntil = perfNow() + MODE_SELECT_MS;
        setStatus('mode-select');
        send([FEATURE_CH, MODE_CC, MODE_MIXER]);
      }
      ledSent = {}; linesSent = [];
    }
    const daw = ports => { for (const p of ports.values()) if (/DAW/.test(p.name || '') && p.state !== 'disconnected') return p; return null; };
    function resolve() {
      if (stopped || !access) return;
      const i = daw(access.inputs), out = daw(access.outputs);
      if (input && input !== i) input.onmidimessage = null;
      if (i && i !== input) i.onmidimessage = onMessage;
      input = i;
      if (!out) { output = null; ledSent = {}; linesSent = []; return setStatus('no-device'); }
      if (out !== output) { output = out; enter(); }
      if (ctl.status !== 'mode-select') setStatus('connected');
    }

    function view() {
      const playing = !!clock.playing, r = playing ? clock.read() : {}, ts = clock.trackerState || {};
      return { playing, state: ts.state, beats: r.beats, phase: r.phase, bpm: r.bpm, confidence: r.confidence, lastFix: lastFix(),
        rejecting: perfNow() < rejectUntil, restartHeld, modeSelect: ctl.status === 'mode-select' };
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
      for (const cc of LOWER) {
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
        send(DAW_OFF);
      }
      setStatus('off');
    }
    return ctl;
  }

  const api = { create, decode, leds, displayLines,
    MAP: { LOWER, COLOUR, FLASH_CH, BUTTON_CH, FEATURE_CH, QUERY_CH, DAW_ON, DAW_OFF, MODE_CC, DISPLAY_TARGET, ACTIONS, BEAT_ON, RESTART_HOLD_MS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MidiController = api;
})(typeof window !== 'undefined' ? window : globalThis);
