# 13 Flow Lab check · 2026-10-25-1438

| check | result | detail |
|---|---|---|
| incompressible: projection removes ≥ 90 % of the divergence; 120 iters ≤ 30 iters | ❌ | vortex: 0.44 % → 0.34 % (120 it: 0.20 %) · kh: 5.66 % → 3.26 % (120 it: 3.12 %) · plume: 11.84 % → 6.55 % (120 it: 5.52 %) · ink: 9.38 % → 5.04 % (120 it: 4.15 %) · rocks: 1.15 % → 0.72 % (120 it: 0.47 %) (rms div / mean speed per cell) |
| dye kept in a closed box, raw scheme, ≤ 1 % per 10 s | ❌ | plume: -58.01 % in 21 s (-28.05 %/10 s, page log -58.66 %) · kh: -71.91 % in 21 s (-34.77 %/10 s, page log -72.75 %) · plume+conserve: -1.70 % in 21 s (-0.82 %/10 s, page log -2.61 %) |
| swirl rate = BPM/120 Hz (±10 %) | ❌ | 90 BPM: want 0.750, zero-cross 0.57, Fourier 0.4, page 0.541 Hz · 120 BPM: want 1.000, zero-cross 0.837, Fourier 0.735, page 0.842 Hz · 150 BPM: want 1.250, zero-cross 0.995, Fourier 0.64, page 1.099 Hz |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.4 ms (n 60) · hat 8.4 ms (n 119) · snare 8.4 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K |
|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| kh | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| plume | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| ink | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| rocks | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| curl | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 |

## Follow-up (same build, by hand)
- Walls are not the dye sink: mean outward velocity at the four walls is 0.1–0.9 cells/s against a mean speed of 38–50 cells/s.
- About half of the raw dye loss follows the divergence that projection leaves behind: kh measured −3.6 … −8.8 %/s vs ∫c·∇·u −1.1 … −4.9 %/s (same sign every sample); plume is mixed.
- Why projection removes only ~45 %: divergence ½(R−L+T−B) and gradient ½(R−L, T−B) are 2-cell central differences, but the Jacobi solve is the compact 5-point Laplacian. div(grad p) is then the wide Laplacian, so the grid-scale part can never be removed (kh 30 → 120 iterations: 3.26 % → 3.12 %). Backward-difference divergence + forward-difference gradient (or the reverse) makes div∘grad equal the 5-point Laplacian exactly.
- Shedding tracks the BPM but runs ~18 % slow at every tempo (0.84 Hz at 120 BPM, page sheddingHz agrees): effective St ≈ 0.165, typical for Re ≈ 100. The wake's sideways speed is only ~2 % of U.
- The page's own probes are honest: divergenceRMS within 1 % of mine, massLog within 1 point, sheddingHz = my zero-crossing rate.
