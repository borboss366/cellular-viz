// The frozen tracker (the reviewer's close-out, the user's go 14 Nov 15:00): qa/CLOCK_CORPUS.md says the constants are
// frozen, and its "Frozen tracker constants" section lists them for the F3/F4 tracker as merged (main 44308b4). This
// test holds the doc and the code together: every DEFAULTS key and value, the module constants, and the source's
// sha256 (so a change to any line of the tracker, not only a named constant, fails until the doc changes with it).
// Runs everywhere (no audio).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../../../experiments/clock-tracker.js');
const DOC = new URL('../../CLOCK_CORPUS.md', import.meta.url), SRC = new URL('../../../experiments/clock-tracker.js', import.meta.url);

/** one table cell -> a number, a fraction like 4/3, a bare word (string), or a [list] of those */
function value(s) {
  s = s.trim();
  if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1).split(',').map(value);
  const m = /^(-?\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(s);
  if (m) return m[2] === undefined ? Number(m[1]) : Number(m[1]) / Number(m[2]);
  return s;
}
/** the doc's frozen section -> { sha256, rows: { name: value } } */
function frozenSection() {
  const md = fs.readFileSync(DOC, 'utf8');
  const start = md.indexOf('\n## Frozen tracker constants');
  assert.ok(start >= 0, 'CLOCK_CORPUS.md has a "Frozen tracker constants" section');
  const end = md.indexOf('\n## ', start + 5), sec = md.slice(start, end < 0 ? undefined : end);
  const sha = /tracker source sha256: `([0-9a-f]{64})`/.exec(sec);
  const rows = {};
  for (const line of sec.split('\n')) {
    const r = /^\| `([A-Za-z_][A-Za-z0-9_]*)` \| `([^`]*)` \|$/.exec(line.trim());
    if (!r) continue;
    assert.ok(!(r[1] in rows), `${r[1]} listed once`);
    rows[r[1]] = value(r[2]);
  }
  return { md, sha256: sha ? sha[1] : null, rows };
}
const MODULE = ['ANALYSIS_DELAY_MS', 'HOLD_PROTECT_BARS', 'EDGES', 'BANDS'];

test('frozen tracker: CLOCK_CORPUS.md lists every DEFAULTS constant of the tracker with its value, and nothing else', () => {
  const { rows } = frozenSection();
  const doc = Object.fromEntries(Object.entries(rows).filter(([k]) => !MODULE.includes(k)));
  const code = { ...T.DEFAULTS };
  const missing = Object.keys(code).filter(k => !(k in doc)), extra = Object.keys(doc).filter(k => !(k in code));
  assert.deepEqual(missing, [], 'in the code, not in the doc');
  assert.deepEqual(extra, [], 'in the doc, not in the code');
  const changed = Object.keys(code).filter(k => JSON.stringify(doc[k]) !== JSON.stringify(code[k])).map(k => `${k}: doc ${JSON.stringify(doc[k])}, code ${JSON.stringify(code[k])}`);
  assert.deepEqual(changed, [], 'every value as in the doc');
  // the F3 and F4 values the doc names (a spot check that the table is the merged F3/F4 tracker, not an older one)
  assert.equal(code.fitInlier, 0.15); assert.equal(code.stepOnsets, 4); assert.equal(code.stepResid, 0.1); assert.equal(code.stepCooldown, 8);
  assert.equal(code.fitChainTol, 0.1); assert.equal(code.acqFloor, 0.25); assert.equal(code.acqRelScore, 0.5); assert.equal(code.acqLookRatio, 1.5);
  // the half-beat fix A (the side at the first lock by two hypotheses, ties by brightness)
  assert.deepEqual([code.sideBeats, code.sideBin, code.sideTie, code.sideBrightLead, code.sideBrightLag], [16, 0.125, 0.2, 0.1, 0.03]);
});

test('frozen tracker: the module constants and the source sha256 match the doc; the frozen sentence points at the list', () => {
  const { md, sha256, rows } = frozenSection();
  assert.equal(rows.ANALYSIS_DELAY_MS, T.ANALYSIS_DELAY_MS);
  assert.equal(rows.HOLD_PROTECT_BARS, T.HOLD_PROTECT_BARS);
  assert.deepEqual(rows.EDGES, T.EDGES);
  assert.deepEqual(rows.BANDS, T.BANDS);
  const now = crypto.createHash('sha256').update(fs.readFileSync(SRC)).digest('hex');
  assert.equal(sha256, now, 'experiments/clock-tracker.js changed: the tracker is frozen (CLOCK_CORPUS.md). A change needs a decision, then this sha256 and the list updated in the same PR');
  assert.match(md, /\*\*Constants are frozen while the corpus grows\.\*\*[^\n]*F3\/F4 tracker as merged \(main 44308b4\)[^\n]*"Frozen tracker constants"/);
  assert.match(md, /Constants are frozen while the corpus grows \(the list is under "Frozen tracker constants"\)/);
});
