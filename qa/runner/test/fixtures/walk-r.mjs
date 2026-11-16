// The fit-long walk diagnosis (report-only, the user's go 16 Nov 13:26; Orchestrator's ask after #245): do the onsets
// sit better on the fit-long target or on the anchor? Read from outside the tracker, no tracker change.
//   periodR: the onsets' concentration on a period, as the tracker's own periodR (clock-tracker.js): |sum s e^(2 pi i t/P)|
//            / sum s over the broadband onsets of the last secs s; null with fewer than minN onsets (2 x laneMinOnsets)
//   walkProbe(C): tick(tr) after every push (or every 0.1 s sample) keeps the anchor, the bpm at the latest lock (a move
//            into 'locked') or at the latest adopted step (tempoReport.steps grew); sample(tr, t) reads the bpm, the
//            anchor, the home tempo (tr.relative.home), the latest fit-long target and R at the target and at the anchor
export function periodR(onsets, P, t, secs, minN) {
  if (!(P > 0) || !onsets) return null;
  let c = 0, s = 0, w = 0, n = 0;
  for (let i = onsets.length - 1; i >= 0 && onsets[i].t > t - secs; i--) {
    if (onsets[i].t > t) continue;
    const th = 2 * Math.PI * onsets[i].t / P;
    c += onsets[i].s * Math.cos(th); s += onsets[i].s * Math.sin(th); w += onsets[i].s; n++;
  }
  return n < minN || !(w > 0) ? null : Math.hypot(c, s) / w;
}

export function walkProbe(C) {
  let anchor = null, anchorAt = null, lastState = null, steps = null;
  return {
    tick(tr, t) {
      const rep = tr.tempoReport || null, st = tr.state;
      if (st === 'locked' && lastState !== 'locked') { anchor = tr.bpm || null; anchorAt = t; }
      if (rep && Number.isInteger(rep.steps)) {
        if (steps !== null && rep.steps !== steps) { anchor = tr.bpm || null; anchorAt = t; }
        steps = rep.steps;
      }
      lastState = st;
    },
    sample(tr, t) {
      const rep = tr.tempoReport || null, rel = tr.relative || null;
      const long = rep && rep.fit && rep.fit.bpm > 0 ? rep.fit.bpm : null, home = rel && rel.home ? rel.home.bpm : null;
      const R = b => (b > 0 ? periodR(tr.onsets || [], 60 / b, t, C.relSecs, 2 * C.laneMinOnsets) : null);
      return { t, bpm: tr.bpm || null, anchor, anchorAt, home, long, longAt: rep && rep.fit ? rep.fit.t : null, rLong: R(long), rAnc: R(anchor) };
    },
  };
}

const f2 = x => (x === null || x === undefined || !Number.isFinite(x) ? '-' : x.toFixed(2)), f3 = x => (x === null || x === undefined ? '-' : x.toFixed(3));
/** one sample as text: bpm, anchor (@ when), home, the fit-long target, R at the target vs R at the anchor (which wins) */
export function walkText(x) {
  if (!x) return '-';
  const win = x.rLong === null || x.rAnc === null ? '' : x.rLong > x.rAnc ? ' long wins' : x.rLong < x.rAnc ? ' anchor wins' : ' tie';
  return `bpm ${f2(x.bpm)} anc ${f2(x.anchor)}${x.anchorAt === null ? '' : '@' + x.anchorAt.toFixed(1)} home ${f2(x.home)} long ${f2(x.long)} R(long) ${f3(x.rLong)} R(anc) ${f3(x.rAnc)}${win}`;
}
