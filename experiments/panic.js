// Panic key for live sets: in every scene, instantly, whatever the scene is doing.
//   B          blackout on / off (instant black; black is never a strobe)
//   ` (or §)   calm fallback on / off
// Not Esc: the browser always leaves fullscreen on Esc, which would drop the projector out of the set.
// Calm: a slow, dim cobalt-violet drift drawn by CSS alone, so it works even if the
//              scene's WebGL has crashed or frozen
// A lost WebGL context (or 3 frame errors in a second, reported through window.__panicError) switches to the
// calm fallback by itself. The overlay lives inside whatever element is fullscreen, so it covers the projector.
// The controller maps a button to window.__panic.blackout() / .calm() / .clear() (issue #85). Include with:
//   <script src="panic.js"></script>   (next to the pages, not in a subfolder: the QA check servers serve one folder)
//
// Panic from the conductor (the apartment MVP, Task 2): every scene also listens on the BroadcastChannel
// 'cellular-viz-clock' (the shared clock's) for { type: 'panic', mode: 'blackout' | 'calm' | 'clear' } and SETS that
// mode (not a toggle, so every window ends up the same); the conductor's panic buttons and its B / ` keys send it.
//
// ?capture=1 (Task 2): the scene as a clean 1920x1080 source for a capture (Resolume, OBS). Everything but the
// scene's canvas (#c) is hidden: controls, the HUD, the shared-clock badge, banners (also ones added later) and the
// 2D label canvases (#ov on 14, 16b, 16c, 18: titles and numbers; a canvas marked data-capture="keep" stays), no cursor, black background. The stage (#wrap, else the canvas's parent) is 1920x1080 CSS px with
// devicePixelRatio read as 1, so the page sizes its canvas to 1920x1080 (or its own cap) whatever the window, and is
// scaled to fit the window, letterboxed. The page's keys still work. Play is pressed once by itself; the first key
// or click in the window resumes the audio when the browser held it back (no user gesture yet).
// __qa.capture = { on, stage, canvas: [w, h], layout }.
// PanicLib (window.PanicLib, or require in node): { CHANNEL, CAPTURE_W, CAPTURE_H, panicMode(msg), captureLayout(w, h) }.
(function (root) {
  const CHANNEL = 'cellular-viz-clock', CAPTURE_W = 1920, CAPTURE_H = 1080;
  // a message on the channel -> the panic mode to set ('blackout' | 'calm' | 'off'), or null when it is not a panic
  function panicMode(msg) {
    if (!msg || typeof msg !== 'object' || msg.type !== 'panic') return null;
    return { blackout: 'blackout', calm: 'calm', clear: 'off' }[msg.mode] || null;
  }
  // the 1920x1080 stage scaled to fit a window of w x h CSS px, centred (letterboxed or pillarboxed)
  function captureLayout(w, h) {
    const scale = Math.min(w / CAPTURE_W, h / CAPTURE_H);
    return { w: CAPTURE_W, h: CAPTURE_H, scale, left: (w - CAPTURE_W * scale) / 2, top: (h - CAPTURE_H * scale) / 2 };
  }
  const lib = { CHANNEL, CAPTURE_W, CAPTURE_H, panicMode, captureLayout };
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.PanicLib = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this);

(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__panic) return;
  const lib = window.PanicLib;
  const css = `
#panicOverlay { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; opacity: 0; transition: opacity 0s; }
#panicOverlay.on { opacity: 1; pointer-events: auto; }
#panicOverlay.black { background: #000; }
#panicOverlay.calm { transition: opacity 0.4s; background:
  radial-gradient(60% 70% at 30% 40%, rgba(31,75,255,0.30), transparent 70%),
  radial-gradient(50% 60% at 70% 60%, rgba(255,31,142,0.16), transparent 70%), #04030e;
  background-size: 200% 200%, 200% 200%, auto; animation: panicDrift 40s ease-in-out infinite alternate; }
@keyframes panicDrift { from { background-position: 0% 0%, 100% 100%, 0 0; } to { background-position: 100% 60%, 0% 30%, 0 0; } }
#panicOverlay .tag { position: absolute; right: 10px; bottom: 8px; font: 11px ui-monospace, Menlo, monospace; color: rgba(255,255,255,0.18); }`;
  const style = document.createElement('style'); style.textContent = css;
  const el = document.createElement('div'); el.id = 'panicOverlay'; el.innerHTML = '<span class="tag"></span>';
  const state = { mode: 'off', since: 0, auto: null, errors: [], received: 0 };
  function place() {
    const host = document.fullscreenElement || document.body;
    if (el.parentNode !== host) host.appendChild(el);
  }
  function set(mode, auto = null) {
    state.mode = mode; state.since = performance.now(); state.auto = auto;
    el.className = mode === 'off' ? '' : `on ${mode === 'blackout' ? 'black' : 'calm'}`;
    el.querySelector('.tag').textContent = mode === 'calm' ? (auto ? `calm fallback (${auto})` : 'calm') : '';
    place();
    window.dispatchEvent(new CustomEvent('panic', { detail: { mode, auto } }));
  }
  const api = {
    get mode() { return state.mode; }, get auto() { return state.auto; },
    blackout() { set(state.mode === 'blackout' ? 'off' : 'blackout'); },
    calm(reason) { set(state.mode === 'calm' && !reason ? 'off' : 'calm', reason || null); },
    clear() { set('off'); },
    // a mode set outright (the conductor's broadcast): 'blackout' | 'calm' | 'off'
    set(mode) { if (mode === 'blackout' || mode === 'calm' || mode === 'off') set(mode); },
    get received() { return state.received; },
  };
  window.__panic = api;
  // a scene's frame loop can report errors; 3 within a second → calm fallback
  window.__panicError = () => {
    const t = performance.now(); state.errors = state.errors.filter(x => t - x < 1000); state.errors.push(t);
    if (state.errors.length >= 3 && state.mode === 'off') set('calm', 'frame errors');
  };
  function init() {
    document.head.appendChild(style); place();
    document.addEventListener('fullscreenchange', place);
    document.addEventListener('webglcontextlost', () => { if (state.mode === 'off') set('calm', 'WebGL context lost'); }, true);
    window.addEventListener('keydown', e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' && e.target.type === 'text' || tag === 'TEXTAREA') return;
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault(); api.blackout();
      } else if (e.key === '`' || e.key === '§' || e.code === 'Backquote') {
        e.preventDefault(); api.calm();
      }
    }, true);
  }
  // the conductor's panic, on the shared clock's channel
  try {
    if (typeof BroadcastChannel === 'function') {
      const ch = new BroadcastChannel(lib.CHANNEL);
      ch.onmessage = e => { const m = lib.panicMode(e && e.data); if (m) { state.received++; set(m); } };
    }
  } catch (e) { /* no channel: the keys still work */ }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

// ?capture=1 (see the header)
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__capture) return;
  let on = false;
  try { on = new URLSearchParams(location.search).get('capture') === '1'; } catch (e) {}
  window.__capture = { on };
  if (!on) return;
  const lib = window.PanicLib;
  try { Object.defineProperty(window, 'devicePixelRatio', { get: () => 1, configurable: true }); } catch (e) {}
  const css = `
html.capture, html.capture body { background: #000 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
html.capture, html.capture * { cursor: none !important; }
html.capture .captureHidden { display: none !important; }
html.capture .captureStage { position: fixed !important; left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important;
  width: ${lib.CAPTURE_W}px !important; height: ${lib.CAPTURE_H}px !important; min-width: 0 !important; min-height: 0 !important;
  max-width: none !important; max-height: none !important; aspect-ratio: auto !important; margin: 0 !important; padding: 0 !important;
  border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #000 !important; transform-origin: 0 0 !important; }
html.capture #panicOverlay .tag { display: none !important; }`;
  function start() {
    const canvases = [...document.querySelectorAll('canvas')];
    const canvas = document.getElementById('c') || canvases.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    document.documentElement.classList.add('capture');
    if (!canvas) return;
    const stage = document.getElementById('wrap') || canvas.parentElement;
    stage.classList.add('captureStage');
    const keep = n => n === stage || n.id === 'panicOverlay' || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'LINK';
    const hideOutside = () => {   // everything that is not on the way to the stage
      for (let n = stage; n && n.parentElement && n !== document.body; n = n.parentElement)
        for (const sib of n.parentElement.children) if (sib !== n && !sib.contains(stage) && !keep(sib)) sib.classList.add('captureHidden');
      for (const c of stage.children) if (c !== canvas && !(c.tagName === 'CANVAS' && c.dataset.capture === 'keep') && c.id !== 'panicOverlay') c.classList.add('captureHidden');
    };
    hideOutside();
    if (typeof MutationObserver === 'function') new MutationObserver(hideOutside).observe(document.body, { childList: true, subtree: false });
    if (typeof MutationObserver === 'function') new MutationObserver(hideOutside).observe(stage, { childList: true });
    let layout = null;
    const fit = () => {
      layout = lib.captureLayout(window.innerWidth, window.innerHeight);
      stage.style.transform = `translate(${layout.left}px, ${layout.top}px) scale(${layout.scale})`;
    };
    window.addEventListener('resize', fit);
    fit();
    window.dispatchEvent(new Event('resize'));   // the page sizes its canvas again, now on the 1920x1080 stage
    const play = document.getElementById('play');
    if (play) setTimeout(() => { if (!window.__capture.played) { window.__capture.played = true; play.click(); } }, 0);
    const qaCapture = () => ({ on: true, stage: stage.id || stage.tagName.toLowerCase(), canvas: [canvas.width, canvas.height],
      layout, hidden: document.querySelectorAll('.captureHidden').length });
    window.__capture.state = qaCapture;
    const qa = window.__qa || (window.__qa = {});
    try { Object.defineProperty(qa, 'capture', { get: qaCapture, configurable: true, enumerable: true }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

// QA drop hook (#88): the shared GPU and flash checks call __qa.forceDrop() so their windows include a drop.
// A page with a musical drop sets window.__qaNextDrop(bars) → the bar its next drop starts at, adds
// window.__qaShift (bars) to its clock and writes window.__qaNowBars each frame; forceDrop() then moves the
// clock to that bar and returns it (false on a page without a drop hook). Visual clock only: the metronome's
// sound is not moved, so this is for checks, not for a set.
(() => {
  if (typeof window === 'undefined') return;
  window.__qaShift = window.__qaShift || 0;
  // next drop in sections of S bars whose drop starts at bar d of the section (the next section's if already in it)
  window.__qaSectionDrop = (b, S, d) => { const k = Math.floor(b / S); return b - k * S < d ? k * S + d : (k + 1) * S + d; };
  const attach = () => {
    if (typeof window.__qaNextDrop !== 'function') return;
    const qa = window.__qa || (window.__qa = {});
    if (qa.forceDrop) return;
    qa.forceDrop = () => {
      const b = window.__qaNowBars, t = Number.isFinite(b) ? window.__qaNextDrop(b) : NaN;
      if (!Number.isFinite(t) || t < b) return false;
      window.__qaShift += t - b;
      return t;
    };
  };
  attach();
  requestAnimationFrame(attach);   // a page that builds window.__qa later still gets it
})();
