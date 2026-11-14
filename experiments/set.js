// The set launcher's logic (the apartment MVP, Task 2): set.json -> one URL and one window per scene. set.html uses
// it in the browser (window.SetLib); node's tests require it.
//   set.json: { version: 1, defaults: { clock, audio, in, capture, ... }, window: { width, height },
//               scenes: [{ name, page: 'NN-name.html', query?: { key: value | null } }] }
//   validate(set)            -> [] or the problems, in words
//   buildUrl(set, scene)     -> 'NN-name.html?clock=shared&audio=line&in=BlackHole&capture=1' (relative to set.html)
//   windowFeatures(set, i)   -> the window.open features: a popup of the set's size, each one offset a little
//   windowName(i)            -> a fixed name per slot, so opening a scene again reuses its window
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

  function buildUrl(set, scene) {
    if (!scene || typeof scene.page !== 'string' || !PAGE.test(scene.page)) throw new Error(`not a page in this folder: ${scene && scene.page}`);
    const q = Object.assign({}, (set && set.defaults) || {}, scene.query || {});
    const parts = [];
    for (const [k, v] of Object.entries(q)) {
      if (v === null || v === undefined || !KEY.test(k)) continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `${scene.page}?${parts.join('&')}` : scene.page;
  }

  function windowFeatures(set, i) {
    const w = (set && set.window && set.window.width) || 1920, h = (set && set.window && set.window.height) || 1080;
    const off = 40 * (i || 0);
    return `popup=yes,width=${w},height=${h},left=${off},top=${off}`;
  }
  const windowName = i => `cellular-viz-set-${i}`;

  const api = { validate, buildUrl, windowFeatures, windowName, PAGE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SetLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
