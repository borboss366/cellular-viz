# 14 Round Point check · 2026-10-27-1422

Area, L, L²/4πA and crossings recomputed from `__qa.polygon` every frame.

| gate | result | detail |
|---|---|---|
| 1 area falls at 2π per unit τ (±3 %), kicks off; round on the section's last beat | ✅ | dA/dτ ÷ 2π: -0.9999 · A 1.698 → 3.3e-4 · round at bar 16 (section ends 16) |
| 1b same, kicks on (between kicks) | ✅ | 28 stretches, worst -0.9987 · 28 bumps |
| 2 L²/4πA never rises between kicks above 1 % of the start area, ends near 1 (kicks off) | ✅ | 1.3369 → 1.0008, largest rise 0 |
| 2b same, kicks on | ✅ | 1.3458 → 1.0007, largest rise between kicks 0 |
| 3 no self-crossings, every frame (my O(n²) test) | ✅ | kicks off 0 in 959 frames · kicks on 0 in 958 frames (page counted 0 / 0) · 65–240 vertices |
| 4 neck pinch on the drop → exactly 2 pieces, then round points | ✅ | 1→2 at bar 14.01 (drop 14, off by 0.01 bar) · after: 2 (still 2 on the section's last frame) · neck 0.0451 → 0.0233, largest rise 0.0003 (reported only) |
| 5 sync from __qa.events (≤ 40 ms) | ✅ | seed 6.3 ms (n 2) · kick 8.5 ms (n 72) · hat 8.5 ms (n 144) · snare 8.5 ms (n 36) · pinch 7.5 ms (n 1) |
| 60 fps 1080p/1440p/4K | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| scene | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| curve | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |
| pinch | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
