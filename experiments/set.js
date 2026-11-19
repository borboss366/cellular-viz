// The set launcher's logic (the apartment MVP, Task 2): set.json -> one URL and one window per scene. set.html uses
// it in the browser (window.SetLib); node's tests require it.
//   set.json: { version: 1, defaults: { clock, audio, in, capture, ... }, window: { width, height, bar? },
//               scenes: [{ name, page: 'NN-name.html', query?: { key: value | null } }] }
//   validate(set)            -> [] or the problems, in words
//   buildUrl(set, scene, over) -> 'NN-name.html?clock=shared&audio=line&in=BlackHole&capture=1' (relative to set.html);
//                            over (optional) wins over the defaults and the scene's own query, e.g. { in: 'USB Audio' }
//                            from set.html's input field (Saturday brief task 2: one input label for every scene)
//   queryIn(search)          -> the ?in= value of a location.search ('' when there is none)
//   windowFeatures(set, i, n, screen) -> the window.open features: a popup whose CONTENT is window.width x height
//                            (Chrome's width/height set the content, not the outer window). With n (the scene count)
//                            and screen ({ availLeft, availTop, availWidth, availHeight }, e.g. window.screen), window i
//                            goes on an even diagonal of the available area: outer size = width x (height + bar), bar
//                            default 63 (Chrome's title + address bar, pt), left = availLeft + i * (availWidth -
//                            outerW) / (n - 1), top the same; n = 1: availLeft/availTop; never left/above the area.
//                            On the show Mac (1728x1079 from y 38, 960x540 + 63, 3 scenes): {0,38} {384,276} {768,514}
//                            (mac session 18 Nov). Without n and screen: the old 40 px cascade from 0,0.
//   windowName(i)            -> a fixed name per slot, so opening a scene again reuses its window
//   SLOTS, slotUrl(slot, inLabel), slotWindowName(slot) -> the two slot windows (slot.html, 19 Nov): 'A' starts on
//                            scene 1, 'B' on scene 2; 'slot.html?slot=A' (+ '&in=<label>' from set.html's field)
(function (root) {
  const PAGE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/;   // a page next to set.html: no folders, no other sites
  const KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;
  const scalar = v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

  function validate(set) {
    const errs = [];
    if (!set || typeof set !== 'object') return ['set.json is not an object'];
    if (set.version !== 1) errs.push(`version must be 1 (is ${JSON.stringify(set.version)})`);
    const checkQuery = (q, where) => {
      if (q === undefined) return;
      if (!q || typeof q !== 'object' || Array.isArray(q)) { errs.push(`${where}: must be an object`); return; }
      for (const [k, v] of Object.entries(q)) {
        if (!KEY.test(k)) errs.push(`${where}: bad key "${k}"`);
        if (v !== null && !scalar(v)) errs.push(`${where}.${k}: must be a string, number, true/false or null`);
      }
    };
    checkQuery(set.defaults, 'defaults');
    if (set.window !== undefined) {
      const w = set.window || {};
      for (const k of ['width', 'height']) if (w[k] !== undefined && !(Number.isInteger(w[k]) && w[k] >= 320 && w[k] <= 7680)) errs.push(`window.${k}: a whole number from 320 to 7680`);
      if (w.bar !== undefined && !(Number.isInteger(w.bar) && w.bar >= 0 && w.bar <= 200)) errs.push('window.bar: a whole number from 0 to 200');
    }
    if (!Array.isArray(set.scenes) || !set.scenes.length) errs.push('scenes: a list with at least one scene');
    else set.scenes.forEach((s, i) => {
      if (!s || typeof s !== 'object') { errs.push(`scenes[${i}]: must be an object`); return; }
      if (typeof s.page !== 'string' || !PAGE.test(s.page)) errs.push(`scenes[${i}].page: a page in this folder, like 13-flow-lab.html (is ${JSON.stringify(s.page)})`);
      if (s.name !== undefined && typeof s.name !== 'string') errs.push(`scenes[${i}].name: must be text`);
      checkQuery(s.query, `scenes[${i}].query`);
    });
    return errs;
  }

  function buildUrl(set, scene, over) {
    if (!scene || typeof scene.page !== 'string' || !PAGE.test(scene.page)) throw new Error(`not a page in this folder: ${scene && scene.page}`);
    const q = Object.assign({}, (set && set.defaults) || {}, scene.query || {}, over || {});
    const parts = [];
    for (const [k, v] of Object.entries(q)) {
      if (v === null || v === undefined || !KEY.test(k)) continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `${scene.page}?${parts.join('&')}` : scene.page;
  }

  function windowFeatures(set, i, n, screen) {
    const win = (set && set.window) || {};
    const w = win.width || 1920, h = win.height || 1080, bar = Number.isFinite(win.bar) ? win.bar : 63;
    i = i || 0;
    if (!(n >= 1) || !screen || typeof screen !== 'object') {
      const off = 40 * i;
      return `popup=yes,width=${w},height=${h},left=${off},top=${off}`;
    }
    const num = (v, d) => (Number.isFinite(v) ? v : d);
    const x0 = num(screen.availLeft, 0), y0 = num(screen.availTop, 0);
    const aw = num(screen.availWidth, w), ah = num(screen.availHeight, h + bar);
    const stepX = n > 1 ? Math.max(0, aw - w) / (n - 1) : 0, stepY = n > 1 ? Math.max(0, ah - (h + bar)) / (n - 1) : 0;
    const left = Math.round(x0 + i * stepX), top = Math.round(y0 + i * stepY);
    return `popup=yes,width=${w},height=${h},left=${left},top=${top}`;
  }
  const windowName = i => `cellular-viz-set-${i}`;
  const SLOTS = ['A', 'B'];
  const slotUrl = (slot, inLabel) => `slot.html?slot=${slot}` + (inLabel ? `&in=${encodeURIComponent(String(inLabel))}` : '');
  const slotWindowName = slot => `cellular-viz-slot-${slot}`;
  function queryIn(search) {
    const m = /[?&]in=([^&#]*)/.exec(String(search || ''));
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch (e) { return ''; }
  }

  const api = { validate, buildUrl, windowFeatures, windowName, queryIn, PAGE, SLOTS, slotUrl, slotWindowName };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SetLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
