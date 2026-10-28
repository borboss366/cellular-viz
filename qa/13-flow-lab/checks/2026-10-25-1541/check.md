# 13 Flow Lab check · 2026-10-25-1541

| check | result | detail |
|---|---|---|
| incompressible (raw): after projection ≤ 5 % of before (MVP bar), every sample, my own MAC divergence | ❌ | vortex: 0.71 % → 0.23 %, worst ratio 32.77 % (120 it: 18.60 %; page 0.22 %) · kh: 4.83 % → 0.69 %, worst ratio 28.02 % (120 it: 6.70 %; page 0.69 %) · plume: 4.02 % → 0.53 %, worst ratio 25.37 % (120 it: 1.62 %; page 0.52 %) · ink: 2.87 % → 0.72 %, worst ratio 28.63 % (120 it: 18.10 %; page 0.72 %) · rocks: 0.97 % → 0.70 %, worst ratio 77.94 % (120 it: 27.08 %; page 0.69 %) (rms div / mean speed per cell) |
| dye kept in a closed box, raw (?conserve=0), ≤ 5 % per 10 s | ✅ | plume: 8.47 % in 21 s (4.03 %/10 s, page log 8.36 %) · kh: -5.82 % in 21 s (-2.76 %/10 s, page log -5.80 %) · plume+conserve: 0.00 % in 21 s (0.00 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ❌ | calibrate(): fNat 1.07 → 1.3825 · 90 BPM: 0.749 Hz real (Fourier 0.75), St 0.2258 (sim 0.2258), amp 152.79 · 120 BPM: 0.996 Hz real (Fourier 0.995), St 0.2254 (sim 0.2255), amp 153.42 · 150 BPM: 1.066 Hz real (Fourier 1.065), St 0.1929 (sim 0.2256), amp 152.96 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ❌ | 90 BPM: want 0.750, got 0.765 (Fourier 0.765), wake amp 146.34 · 120 BPM: want 1.000, got 0.999 (Fourier 1), wake amp 156.18 · 150 BPM: want 1.250, got 1.066 (Fourier 1.065), wake amp 151.95 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 18.1 ms (n 60) · hat 18.1 ms (n 119) · snare 18.1 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ❌ | |
| 1440p p95 ≤ 16.8 ms | ❌ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K |
|---|---|---|---|---|---|
| vortex | 33.4 / 63 | 33.4 / 71 | 33.4 / 84 | 3840×2160 | 455×256 / 1920×1080 |
| kh | 133.3 / 93 | 133.3 / 97 | 133.4 / 84 | 3840×2160 | 455×256 / 1920×1080 |
| plume | 16.7 / 7 | 16.8 / 10 | 33.2 / 24 | 3840×2160 | 455×256 / 1920×1080 |
| ink | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 |
| rocks | 66.7 / 128 | 66.8 / 130 | 66.8 / 96 | 3840×2160 | 455×256 / 1920×1080 |
| curl | 66.6 / 141 | 66.6 / 139 | 50.1 / 121 | 3840×2160 | 455×256 / 1920×1080 |

## Follow-up (same build, by hand, nothing else on the GPU)
- fps drop is the fixed sim step: dtSim 1/120 = 2 steps per 60 Hz frame, each with 40 red-black iterations (80 passes) → 4× the old pressure cost. kh at 1080p: 70fc2c4 60 fps (1 step/frame) · ddb3d49 30 fps, 2.95 steps/frame, sim at 0.73× real time (a frame slips, the accumulator asks for more steps, up to 4) · ddb3d49 + dtSim=1/60: 60 fps · + pressureIters=20: 60 fps.
- The 150 BPM shedding/lock miss is the same cause: the sim clock should run at 0.904× real, measured 0.772×, so the street plays 15 % slow. 90 and 120 BPM run on time and land on the beat even with lock=0 after calibrate() (0.749 / 0.996 Hz).
- calibrate() at 120 BPM: fNat 1.07 → 1.3825 per sim-second, St = 0.226 (sim clock, same at all tempos as designed).
- Median share of divergence left after one projection (40 it / 120 it): vortex 32 / 11 %, kh 18 / 2.4 %, plume 17 / 1.4 %, ink 25 / 4.3 %, rocks 72 / 25 %. 40 red-black iterations do about what 40 Jacobi did; ≤ 5 % needs ~120 or multigrid.
