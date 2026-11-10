// One heavy box test at a time (#214, test 176 at 3c8d048: the conductor smoke run logged 7 clock beats where earlier
// heads logged 8-17). node --test runs the test FILES in parallel, so tracker-corpus.test.mjs (Chromium decodes whole
// tracks, then both trackers run over minutes of audio) shared the CPU with the smoke run's headless page, whose
// frame loop logs the clock's output beats. The shadow's beats come from the worklet messages and kept up (22); the
// clock's, logged from the page's frame loop, did not. Both files now take this lock around their heavy parts.
//   const release = await heavyLock('name'); t.after(release);
// A directory lock in the OS temp folder (mkdir is atomic); a lock whose owner process is gone, or older than 15 min,
// is broken. After waitMs the caller goes on without it (and says so) rather than time out.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = path.join(os.tmpdir(), 'cellular-viz-heavy.lock');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function heavyLock(name, { waitMs = 200e3 } = {}) {
  const t0 = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(DIR);
      fs.writeFileSync(path.join(DIR, 'owner'), JSON.stringify({ pid: process.pid, name, at: Date.now() }));
      const waited = Date.now() - t0;
      if (waited > 1000) console.log(`# heavy lock: ${name} waited ${(waited / 1000).toFixed(1)} s`);
      let done = false;
      return () => { if (done) return; done = true; try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {} };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    let owner = null;
    try { owner = JSON.parse(fs.readFileSync(path.join(DIR, 'owner'), 'utf8')); } catch {}
    let age = 0;
    try { age = Date.now() - fs.statSync(DIR).mtimeMs; } catch {}
    if ((owner && (!alive(owner.pid) || Date.now() - owner.at > 15 * 60e3)) || (!owner && age > 60e3)) {
      try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {}
      continue;
    }
    if (Date.now() - t0 > waitMs) {
      console.log(`# heavy lock: ${name} went on without the lock after ${(waitMs / 1000).toFixed(0)} s (held by ${owner ? owner.name : '?'})`);
      return () => {};
    }
    await sleep(250);
  }
}
