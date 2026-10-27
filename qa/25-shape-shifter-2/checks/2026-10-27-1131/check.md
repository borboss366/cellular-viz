# 25 Shape Shifter II check · 2026-10-27-1131

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 6 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: each hole crossed once (trefoil linking 2) | ❌ | 10 dives, 2 off: phrase 3: ring ×1 (+1), ring ×0 (0), ring ×1 (-1); phrase 9: knot (knot) ×1 (-2), ring ×1 (+1), ring ×0 (0) |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 68.258 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ✅ | fwd p99 148°/s, max 295°/s · up p99 245°/s |
| 4c no empty picture longer than ¼ s (25-ray test) | ✅ | 0 stretches |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ✅ | mean 25.8 %, 10th percentile 12 % |
| 5 sync (≤ 40 ms) | ✅ | kick 17.9 ms (n 60) · hat 17.8 ms (n 119) · snare 18 ms (n 30) · land 17.1 ms (n 5) · attach 16.8 ms (n 1) · thread 3.7 ms (n 1) |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |
| res=native | – | 16.8 / 0 | 16.7 / 1 | 3840×2160 |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
