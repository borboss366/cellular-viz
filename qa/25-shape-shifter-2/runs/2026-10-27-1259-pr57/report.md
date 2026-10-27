# 25-shape-shifter-2 · #57 @cbbe220

25 Shape Shifter II round 7: no frame stalls at native 4K (dynamic resolution renders into a corner of one full-size target; predicted start scale, steps back up when fast), plus a look at the stretched picture on either side of each scale change. Window 0.5-24.5 s so the late steps (round 5: ~17 s, bar 8.4) fall inside it.

15/16 gates pass · warm-up 0.5 s · 24 s per run · swipe run `qa/25-shape-shifter-2/runs/2026-10-27-1259-pr57-swipe`

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | errors | gpuBusy | value.renderScale | value.render | value.canvas |
|---|---|---|---|---|---|---|---|---|---|---|
| auto@1080p | 59.71 | 59.88 | 16.7 | 50.1 | 0.28 | 0 | 0 | 0.88 | [1690,950] | [1920,1080] |
| auto@4k | 59.71 | 59.52 | 16.8 | 66.7 | 0.21 | 0 | 5 | 1 | [1920,1080] | [1920,1080] |
| native@1080p | 59.67 | 59.52 | 16.8 | 66.6 | 0.28 | 0 | 6 | 1 | [1920,1080] | [1920,1080] |
| native@4k | 59.13 | 59.52 | 16.8 | 149.9 | 0.21 | 0 | 6 | 0.5 | [1920,1080] | [3840,2160] |

- ✅ native 4K: about 3 frames over 20 ms in 1400 · native@4k 0.21
- ✅ default render: at most 0.5 % of frames over 20 ms · auto@1080p 0.28 · auto@4k 0.21
- ✅ fps.p05 ≥ 55 · auto@1080p 59.88 · auto@4k 59.52 · native@1080p 59.52 · native@4k 59.52
- ✅ errors ≤ 0 · auto@1080p 0 · auto@4k 0 · native@1080p 0 · native@4k 0
- ✅ gpuBusy ≤ 10 · auto@1080p 0 · auto@4k 5 · native@1080p 6 · native@4k 6
- ✅ check-25: 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) · 35 keyframes, 0 wrong
- ✅ check-25: 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) · 768 moments, 6 flagged at n = 128 but right on a finer grid, 0 wrong
- ❌ check-25: 3 slalom: each hole crossed once (trefoil linking 2) · 10 dives, 2 off: phrase 3: ring ×1 (+1), ring ×0 (0), ring ×1 (-1); phrase 9: knot (knot) ×1 (-2), ring ×1 (+1), ring ×0 (0)
- ✅ check-25: 4a camera ≥ 0.05 from the surface, every frame · min 0.080 at bar 68.258 (thread), 11519 frames
- ✅ check-25: 4b view turn rate p99 ≤ 180°/s · fwd p99 148°/s, max 295°/s · up p99 245°/s
- ✅ check-25: 4c no empty picture longer than ¼ s (25-ray test) · 0 stretches
- ✅ check-25: 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames · mean 25.8 %, 10th percentile 12 %
- ✅ check-25: 5 sync (≤ 40 ms) · kick 8.3 ms (n 60) · hat 8.3 ms (n 119) · snare 8.2 ms (n 30) · land 7.8 ms (n 5) · attach 8.9 ms (n 1) · thread 7.7 ms (n 1)
- ✅ check-25: 60 fps
- ✅ check-25: page alive
- ✅ check-25: errors · none
