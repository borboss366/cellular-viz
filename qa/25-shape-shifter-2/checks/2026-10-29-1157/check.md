# 25 Shape Shifter II check · 2026-10-29-1157

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 6 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: 1–2 holes per dive, each passed once (trefoil linking 2), as planned | ✅ | 10 dives, 0 off · genus-3 dives skip one hole (allowed) |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 68.258 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ✅ | fwd p99 148°/s, max 295°/s · up p99 245°/s, max 7805°/s · 209 frames > 180°/s<br>fwd peaks: 295° bar 43.317 (thread, phrase bar 3.32), 249° bar 11.325 (thread, phrase bar 3.32), 247° bar 84.308 (thread, phrase bar 4.31), 207° bar 59.358 (thread, phrase bar 3.36), 207° bar 91.358 (thread, phrase bar 3.36)<br>up peaks: 7805° bar 11.342 (thread, phrase bar 3.34), 7605° bar 59.375 (thread, phrase bar 3.37), 7418° bar 91.375 (thread, phrase bar 3.38), 957° bar 12.642 (thread, phrase bar 4.64), 602° bar 60.717 (thread, phrase bar 4.72) |
| 4c no empty picture longer than ¼ s (25-ray test) | ✅ | 0 stretches |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ✅ | mean 25.8 %, 10th percentile 12 % |
| 5 sync (≤ 40 ms) | ✅ | kick 17.9 ms (n 60) · hat 17.7 ms (n 119) · snare 18.1 ms (n 30) · land 17.3 ms (n 5) · attach 17 ms (n 1) · thread -0.6 ms (n 1) |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 |
| res=native | – | 16.7 / 0 | 16.7 / 0 | 3840×2160 |
