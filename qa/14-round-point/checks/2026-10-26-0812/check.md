# 14 Round Point check · 2026-10-26-0812

Area, L, L²/4πA and crossings recomputed from `__qa.polygon` every frame.

| gate | result | detail |
|---|---|---|
| 1 area falls at 2π per unit τ (±3 %), kicks off; round on the section's last beat | ✅ | dA/dτ ÷ 2π: -0.9999 · A 1.698 → 3.4e-4 · round at bar 16 (section ends 16) |
| 1b same, kicks on (between kicks) | ✅ | 28 stretches, worst -0.9987 · 28 bumps |
| 2 L²/4πA never rises between kicks, ends near 1 (kicks off) | ❌ | 1.3369 → 1.0007, largest rise 0.00021 at bar 15.97 |
| 2b same, kicks on | ❌ | 1.3458 → 1.0006, largest rise between kicks 0.000383 at bar 15.99 |
| 3 no self-crossings, every frame (my O(n²) test) | ✅ | kicks off 0 in 960 frames · kicks on 0 in 959 frames (page counted 0 / 0) · 71–240 vertices |
| 4 neck pinch on the drop → exactly 2 pieces, then round points | ❌ | 1→2 at bar 14.01 (drop 14, off by 0.01 bar) · after: 2 · neck 0.2035 → 0.0296, largest rise 0.0015 |
| 5 sync from __qa.events (≤ 40 ms) | ✅ | seed 17.9 ms (n 2) · kick 17.9 ms (n 72) · hat 17.7 ms (n 143) · snare 17.9 ms (n 36) · pinch 18.9 ms (n 1) |
| 60 fps 1080p/1440p/4K | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| scene | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| curve | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |
| pinch | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 |

## Notes
- **As pushed, 3862e5b does not load:** `SyntaxError: Unary operator used immediately before exponentiation` in `curveBump`: `Math.exp(-(d / w) ** 2)`. The whole script dies, `__qa` is undefined and the HUD stays at "loading…". The table above is from a local copy with the one fix `Math.exp(-((d / w) ** 2))` (qa/history/2026-10-26-0808-check-14-patched.sh).
- Roundness (qa/history/2026-10-26-0815-probe14-neck-iso.sh): L²/4πA never rises while the area is above 1 % of the start; the only rises (≤ 3.3e-4) come in the last 0.6 % of area (last ~30 ms), when remeshing drops the vertex count 134 → 68.
- Neck: with a parabola through the three lowest samples (removes the 96-point resampling jitter) the neck shrinks monotonically 0.045 → 0.023 except for one rise of 3e-4 between the first two keyframes (the seeded dumbbell settling).
