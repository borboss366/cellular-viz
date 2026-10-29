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
(() => {
  if (window.__panic) return;
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
  const state = { mode: 'off', since: 0, auto: null, errors: [] };
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

// QA drop hook (#88): the shared GPU and flash checks call __qa.forceDrop() so their windows include a drop.
// A page with a musical drop sets window.__qaNextDrop(bars) → the bar its next drop starts at, adds
// window.__qaShift (bars) to its clock and writes window.__qaNowBars each frame; forceDrop() then moves the
// clock to that bar and returns it (false on a page without a drop hook). Visual clock only: the metronome's
// sound is not moved, so this is for checks, not for a set.
(() => {
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
