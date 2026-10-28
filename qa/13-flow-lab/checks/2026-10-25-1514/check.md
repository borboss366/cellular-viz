# 13 Flow Lab check · 2026-10-25-1514

| check | result | detail |
|---|---|---|
| incompressible (raw): after projection ≤ 1 % of before, every sample, my own MAC divergence | ❌ | vortex: 0.67 % → 0.28 %, worst ratio 41.62 % (120 it: 24.68 %; page 0.27 %) · kh: 6.96 % → 0.84 %, worst ratio 17.03 % (120 it: 6.50 %; page 0.82 %) · plume: 14.48 % → 1.22 %, worst ratio 10.87 % (120 it: 6.40 %; page 1.21 %) · ink: 10.87 % → 1.07 %, worst ratio 10.32 % (120 it: 6.70 %; page 1.06 %) · rocks: 1.27 % → 0.53 %, worst ratio 43.71 % (120 it: 23.81 %; page 0.52 %) (rms div / mean speed per cell) |
| dye kept in a closed box, raw (?conserve=0), ≤ 5 % per 10 s | ❌ | plume: -35.74 % in 21 s (-17.18 %/10 s, page log -38.05 %) · kh: -51.19 % in 21 s (-24.63 %/10 s, page log -51.25 %) · plume+conserve: 1.70 % in 21 s (0.82 %/10 s, page log 3.65 %) |
| natural swirl rate (?lock=0) within 10 % of Roshko St(Re) | ❌ | 90 BPM: Roshko 0.75 Hz (Re 74.7), measured 0.972 (Fourier 0.73, page 0.899); St 0.1967 vs 0.1518 · 120 BPM: Roshko 1 Hz (Re 92.5), measured 1.069 (Fourier 0.845, page 1.195); St 0.1746 vs 0.1634 · 150 BPM: Roshko 1.25 Hz (Re 110.3), measured 1.178 (Fourier 0.96, page 0.945); St 0.1614 vs 0.1713 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ❌ | 90 BPM: want 0.750, got 0.958 (Fourier 0.89), wake amp 48.85 · 120 BPM: want 1.000, got 1.046 (Fourier 1.005), wake amp 45.62 · 150 BPM: want 1.250, got 1.119 (Fourier 1.015), wake amp 24.68 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.5 ms (n 60) · hat 8.5 ms (n 119) · snare 8.7 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K |
|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| kh | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| plume | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| ink | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| rocks | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| curl | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |

## Follow-up (same build, by hand)
- My MAC divergence matches the page's divergenceRMS to ≤ 2 %, so both read the same thing. The stencil fix worked (kh/plume/ink now remove ~90 %), but 40 Jacobi iterations on 455×256 can't reach 1 %: 120 iterations halve the rest (kh 15 % → 6.4 %). It's now iteration-limited; open-outflow + obstacle recipes (vortex, rocks) are worst (~42 % left).
- Dye leaves only through the top and right walls: those faces aren't stored on the MAC grid, so velAt() clamps to the last stored face (v of the top row's bottom face, u of the last column's left face) instead of 0. Measured outflow: plume top 0.9–1.4 %/s + right 0.1–0.6 %/s ≈ all of its loss (1–1.7 %/s); kh right 0.7–1.0 %/s + top 0.2–0.3 %/s ≈ a third to half of 2–4.8 %/s. Left and bottom: 0.
- Natural shedding hardly follows the inflow: U × 1.48 (90 → 150 BPM) gives f × 1.21. The Re implied by Roshko from the measured St falls as U rises (294 → 120 → 89), so the ν = 85 fit doesn't describe this flow (blockage d/H = 0.14 and vorticity confinement both shift St). Lock-in at 6 % of U pulls the street to the beat only at 120 BPM.
