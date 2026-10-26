# 25 Shape Shifter II check · 2026-10-26-1316

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 36 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars) | ❌ | 768 moments, 16 wrong: bars 16.25–16.25 mine 3 want 2 (mug→amphora); bars 17.25–17.25 mine 3 want 2 (amphora→trophy); bars 17.5–17.5 mine 3 want 2 (amphora→trophy); bars 22.125–22.125 mine 4 want 2 (trophy→double torus); bars 22.875–23 mine 3 want 2 (trophy→double torus); bars 24.875–24.875 mine 4 want 3 (triple torus→pretzel); bars 25.375–25.375 mine 4 want 3 (pretzel→triple torus); bars 31.375–31.375 mine 4 want 3 (pretzel→triple torus); bars 47.5–47.5 mine 2 want 1 (key ring→mug); bars 47.75–47.75 mine 4 want 1 (key ring→mug); bars 50.375–50.375 mine 2 want 0 (bell→teapot); bars 52.625–52.625 mine 1 want 0 (egg→bell) … 15 stretches |
| 3 slalom: each hole crossed once (trefoil linking 2) | ❌ | 10 dives, 4 off: phrase 1: ring ×2 (0); phrase 2: ring ×1 (+1), ring ×2 (-2); phrase 10: knot (knot) ×1 (-2), ring ×3 (-1); phrase 11: knot (knot) ×2 (0) |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.061 at bar 92.633 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ❌ | fwd p99 306°/s, max 8499°/s · up p99 491°/s |
| 5 sync (≤ 40 ms) | ✅ | kick 8.4 ms (n 60) · hat 8.4 ms (n 119) · snare 8.4 ms (n 30) · land 8.7 ms (n 5) · attach 8.7 ms (n 1) · thread 4.9 ms (n 1) |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |
| res=native | – | 16.8 / 0 | 16.7 / 0 | 3840×2160 |

## Follow-up
- Flagged live moments re-counted at n = 128 / 192 / 256 (qa/history/2026-10-26-1435-probe25-genus-fine.sh). Grid artefacts that settle to the expected genus by n = 192–256: bars 16.25, 17.5, 22.875, 23, 24.875, 50.375, 64.875, 89.5. Wrong at every resolution (near-touching surfaces mid-morph make extra loops): 22.125 trophy→double torus (3 vs 2), 25.375 pretzel→triple torus (4/5 vs 3), 31.375 pretzel→triple torus (6/5 vs 3), 47.5 key ring→mug (2 vs 1), 52.625 egg→bell with the knot half-absorbed (1 vs 0), 60.625 (2 vs 1); 17.25 and 47.75 flip between resolutions.
- Turn rate (qa/history/2026-10-26-1445-probe25-turns.sh): frames above 180°/s — thread 377 of 3900, skim 84 of 1785, orbit 13 of 5834. Worst at phrase bar ≈ 5.4 (the slalom's exit): bar 21.46 8499°/s (a jump), bars 77.42–77.45 850–1360°/s.
