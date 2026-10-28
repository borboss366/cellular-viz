// 2026-10-25 21:31 · UI test of the compare-page note boxes on a throwaway copy of a run (qa/zz-notetest) served on :8799
import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os';
const R = os.homedir() + '/qa-libs/root', dir = 'qa/zz-notetest/runs/2026-10-25-1957';
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf' } });
const p = await b.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8799/run/zz-notetest/2026-10-25-1957/compare'); await p.waitForSelector('.lnote');
const n0 = JSON.parse(fs.readFileSync(dir + '/comparisons.json')).length;
const first = await p.$eval('.lnote', e => e.dataset.label);
await p.tap('.lnote'); await p.fill('.lnote', 'typed on the phone'); await p.locator('.lnote').first().blur(); await p.waitForTimeout(1200);
const n1 = JSON.parse(fs.readFileSync(dir + '/comparisons.json')).length;
const saved = await p.$eval('.saved', e => e.textContent);
await p.fill('#pnote', 'pick note from the UI'); await p.click('.side[data-i="0"]'); await p.waitForTimeout(1200);
const comps = JSON.parse(fs.readFileSync(dir + '/comparisons.json'));
const v = JSON.parse(fs.readFileSync(dir + '/verdicts.json'));
console.log(JSON.stringify({ tappingNoteDidNotPick: n1 === n0, saved, lookNote: v[first]?.note, lastPick: comps.at(-1), pickBoxCleared: await p.$eval('#pnote', e => e.value === ''), errs }));
await b.close();
