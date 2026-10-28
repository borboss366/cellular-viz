# 25 Shape Shifter II check · 2026-10-26-1642

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 6 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: each hole crossed once (trefoil linking 2) | ✅ | 10 dives, 0 off |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 36.675 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ❌ | fwd p99 223°/s, max 3845°/s · up p99 365°/s |
| 4c no empty picture longer than ¼ s (25-ray test) | ❌ | 10 stretches, longest 2.08 s at bar 11.1 (thread), 1.82 s at bar 91.225 (thread), 1.8 s at bar 59.233 (thread), 1.02 s at bar 19.783 (thread) |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ❌ | mean 20.9 %, 10th percentile 4 % |
| 5 sync (≤ 40 ms) | ✅ | kick 8.3 ms (n 60) · hat 8.3 ms (n 119) · snare 8.3 ms (n 30) · land 8.2 ms (n 5) · attach 8.2 ms (n 1) · thread 5.3 ms (n 1) |
| 60 fps | ❌ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 1920×1080 |
| res=native | – | 16.7 / 0 | 33.4 / 73 | 3840×2160 |

## Turn probe on acef3bb (qa/history/2026-10-26-1445-probe25-turns.sh)
```
{"byMode":{"orbit":{"frames":5594,"over":0,"upOver":46},"thread":{"frames":4200,"over":207,"upOver":281},"skim":{"frames":1725,"over":59,"upOver":75}},"top":[{"bars":37.033,"phraseBar":5.033,"mode":"thread→thread","fwd":3845,"up":1480},{"bars":55.533,"phraseBar":7.533,"mode":"skim→skim","fwd":3366,"up":2292},{"bars":55.558,"phraseBar":7.558,"mode":"skim→skim","fwd":1588,"up":1004},{"bars":55.567,"phraseBar":7.567,"mode":"skim→skim","fwd":1353,"up":1013},{"bars":55.525,"phraseBar":7.525,"mode":"skim→skim","fwd":1315,"up":1438},{"bars":37.042,"phraseBar":5.042,"mode":"thread→thread","fwd":1196,"up":1117},{"bars":55.55,"phraseBar":7.55,"mode":"skim→skim","fwd":1073,"up":1211},{"bars":55.575,"phraseBar":7.575,"mode":"skim→skim","fwd":1055,"up":980}]}
```
