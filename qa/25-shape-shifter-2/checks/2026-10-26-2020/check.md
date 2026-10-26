# 25 Shape Shifter II check · 2026-10-26-2020

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 6 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: each hole crossed once (trefoil linking 2) | ✅ | 10 dives, 0 off |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 76.15 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ❌ | fwd p99 192°/s, max 379°/s · up p99 253°/s |
| 4c no empty picture longer than ¼ s (25-ray test) | ❌ | 3 stretches, longest 0.73 s at bar 89.467 (orbit), 0.57 s at bar 95.425 (orbit), 0.33 s at bar 11.117 (thread) |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ❌ | mean 23.7 %, 10th percentile 8 % |
| 5 sync (≤ 40 ms) | ✅ | kick 8.3 ms (n 60) · hat 8.3 ms (n 119) · snare 8.4 ms (n 30) · land 8.1 ms (n 5) · attach 8.2 ms (n 1) · thread 4.4 ms (n 1) |
| 60 fps | ❌ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |
| res=native | – | 16.7 / 0 | 16.8 / 24 | 3571×2009 |

## Turn probe (qa/history/2026-10-26-1445-probe25-turns.sh on 71f3673)
```
{"byMode":{"orbit":{"frames":5594,"over":0,"upOver":0},"thread":{"frames":4200,"over":132,"upOver":277},"skim":{"frames":1725,"over":0,"upOver":0}},"top":[{"bars":76.2,"phraseBar":4.2,"mode":"thread→thread","fwd":379,"up":754},{"bars":76.192,"phraseBar":4.192,"mode":"thread→thread","fwd":377,"up":646},{"bars":76.208,"phraseBar":4.208,"mode":"thread→thread","fwd":373,"up":797},{"bars":28.175,"phraseBar":4.175,"mode":"thread→thread","fwd":373,"up":207},{"bars":28.183,"phraseBar":4.183,"mode":"thread→thread","fwd":372,"up":206},{"bars":76.183,"phraseBar":4.183,"mode":"thread→thread","fwd":368,"up":530},{"bars":28.167,"phraseBar":4.167,"mode":"thread→thread","fwd":365,"up":203},{"bars":28.192,"phraseBar":4.192,"mode":"thread→thread","fwd":363,"up":200}]}
```
