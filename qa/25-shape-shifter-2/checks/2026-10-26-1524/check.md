# 25 Shape Shifter II check · 2026-10-26-1524

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ❌ | 768 moments, 16 flagged at n = 128 but right on a finer grid, 2 wrong: bars 28.75–28.75 mine 5 want 3 (pretzel→pretzel); bars 47.5–47.5 mine 2 want 1 (key ring→mug) |
| 3 slalom: each hole crossed once (trefoil linking 2) | ✅ | 10 dives, 0 off |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 18.725 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ❌ | fwd p99 224°/s, max 8345°/s · up p99 334°/s |
| 5 sync (≤ 40 ms) | ✅ | kick 8.2 ms (n 60) · hat 8.4 ms (n 119) · snare 8.2 ms (n 30) · land 8.2 ms (n 5) · attach 8.2 ms (n 1) · thread 5 ms (n 1) |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |
| res=native | – | 16.8 / 0 | 16.8 / 0 | 3840×2160 |

## Follow-up (qa/history/2026-10-26-1445-probe25-turns.sh on 9363bf0)
- Frames above 180°/s: thread 131 of 4200, skim 93 of 1725, orbit 0 of 5594. Two jumps: bar 36.97 (phrase bar 4.97, in the slalom) 8345°/s; bars 55.47–55.52 (phrase bar 7.5, skim, the last beat before the phrase downbeat) up to 6690°/s.
- The two real genus misses stay wrong at n = 192 and 256: bar 28.75 pretzel→pretzel 4 vs 3; bar 47.5 key ring→mug 2 vs 1.
