# 13 Flow Lab check · 2026-10-25-1854

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.92 % (worst 1.53 %, 46 it) · fixed 40 0.90 % · 120 0.37 % · plume: 1.86 % (worst 2.36 %, 46 it) · fixed 40 1.98 % · 120 0.44 % · ink: 3.55 % (worst 6.35 %, 46 it) · fixed 40 3.30 % · 120 3.01 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 17.27 % (worst 28.82 %, 64 it): far 30.84 %, obstacle 2.10 %, edge 162.87 % · fixed 120: far 12.20 %, obstacle 0.88 %, edge 77.34 % · rocks: all 21.45 % (worst 24.62 %, 52 it): far 31.80 %, obstacle 6.64 %, edge 39.25 % · fixed 120: far 16.91 %, obstacle 2.00 %, edge 18.36 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.65 % in 21 s (-0.31 %/10 s, page log -0.54 %) · kh: -0.63 % in 21 s (-0.30 %/10 s, page log -0.65 %) · ink: -0.15 % in 21 s (-0.07 %/10 s, page log -0.12 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: 0.00 % in 21 s (0.00 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.1241 → 1.2081 · 90 BPM: 0.814 Hz real (Fourier 0.815), St 0.1998 (sim 0.1998), amp 151.37 · 120 BPM: 1.077 Hz real (Fourier 1.075), St 0.1981 (sim 0.1982), amp 151.46 · 150 BPM: 1.342 Hz real (Fourier 1.34), St 0.1975 (sim 0.1974), amp 151.44 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ❌ | 90 BPM: want 0.750, got 0.808 (Fourier 0.81), wake amp 147.69 · 120 BPM: want 1.000, got 1.062 (Fourier 1.065), wake amp 147.14 · 150 BPM: want 1.250, got 1.337 (Fourier 1.34), wake amp 149.08 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.6 ms (n 60) · hat 8.6 ms (n 119) · snare 8.6 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 64 / 52 | 11.7 | 0.89 |
| kh | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| plume | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1 |
| ink | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 46 | 10.3 | 1 |
| rocks | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11.2 | 1 |
| curl | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1 |

## Follow-up · curl drift probe and beat with the calibrated fNat
Curl drift probe (qa/history/2026-10-25-1717-curl-drift-probe.mjs on bc01f4d):
```
default {"per10s":-1.06,"divRel":0.00000244,"meanSpeed":111.2,"wallNormalMax":0,"cflMax":null}
&wind=45 {"per10s":-0.4,"divRel":0.00000238,"meanSpeed":55.7,"wallNormalMax":0,"cflMax":null}
&wind=22.5 {"per10s":-0.45,"divRel":0.00000238,"meanSpeed":27.8,"wallNormalMax":0,"cflMax":null}
&octaves=1 {"per10s":-0.53,"divRel":0.00000216,"meanSpeed":65.3,"wallNormalMax":0,"cflMax":null}
&noiseScale=1.1 {"per10s":-1.62,"divRel":0.00000403,"meanSpeed":131.5,"wallNormalMax":0,"cflMax":null}
```
RK3 also changes the street: calibrate() now gives fNat 1.2081 (St 0.198), so the shipped 1.1241 runs 6–8 % fast. With ?fNat=1.2081, push on, 60 s (qa/history/2026-10-25-1900-beat60-fnat-probe.sh): 90 BPM +0.7 %, 120 BPM +0.1 %, 150 BPM +0.1 %.
