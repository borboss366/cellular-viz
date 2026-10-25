# 13 Flow Lab check · 2026-10-25-1745

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 1.13 % (worst 1.55 %, 46 it) · fixed 40 1.45 % · 120 0.20 % · plume: 0.97 % (worst 1.53 %, 46 it) · fixed 40 1.49 % · 120 0.37 % · ink: 2.94 % (worst 7.89 %, 46 it) · fixed 40 7.25 % · 120 1.74 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 15.29 % (worst 22.67 %, 64 it): far 20.61 %, obstacle 2.22 %, edge 131.51 % · fixed 120: far 17.90 %, obstacle 1.45 %, edge 100.44 % · rocks: all 33.53 % (worst 38.31 %, 52 it): far 42.91 %, obstacle 6.16 %, edge 43.22 % · fixed 120: far 13.10 %, obstacle 1.93 %, edge 26.97 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ❌ | plume: -1.52 % in 21 s (-0.74 %/10 s, page log -5.36 %) · kh: -5.67 % in 21 s (-2.75 %/10 s, page log -6.33 %) · ink: 3.28 % in 21 s (1.59 %/10 s, page log 1.77 %) · curl: -27.24 % in 21 s (-13.21 %/10 s, page log -22.71 %) · plume+conserve: 5.03 % in 21 s (2.43 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.1241 → 1.1134 · 90 BPM: 0.719 Hz real (Fourier 0.715), St 0.1763 (sim 0.1763), amp 124.78 · 120 BPM: 0.987 Hz real (Fourier 0.985), St 0.1815 (sim 0.1816), amp 121.09 · 150 BPM: 1.288 Hz real (Fourier 1.29), St 0.1896 (sim 0.1896), amp 120.33 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ❌ | 90 BPM: want 0.750, got 0.707 (Fourier 0.7), wake amp 122.78 · 120 BPM: want 1.000, got 0.988 (Fourier 0.985), wake amp 130.23 · 150 BPM: want 1.250, got 1.229 (Fourier 1.245), wake amp 125.46 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.7 ms (n 60) · hat 8.6 ms (n 119) · snare 8.6 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 64 / 52 | 11.7 | 0.89 |
| kh | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.5 | 1 |
| plume | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1 |
| ink | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 46 | 10.2 | 1 |
| rocks | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11.1 | 1 |
| curl | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1 |

## Follow-up · beat over 60 s (qa/history/2026-10-25-1758-beat60-probe.sh)
The 24 s window above resolves ±4 %, too coarse for a ±5 % gate; check-13 now samples 60 s.
```
{"bpm":90,"lock":true,"want":0.75,"got":0.7542,"off":0.6,"cycles":44}
{"bpm":120,"lock":true,"want":1,"got":0.9698,"off":-3,"cycles":57}
{"bpm":150,"lock":true,"want":1.25,"got":1.217,"off":-2.6,"cycles":72}
{"bpm":90,"lock":false,"want":0.75,"got":0.7309,"off":-2.5,"cycles":43}
{"bpm":120,"lock":false,"want":1,"got":0.9643,"off":-3.6,"cycles":57}
{"bpm":150,"lock":false,"want":1.25,"got":1.2337,"off":-1.3,"cycles":73}
default {"per10s":-9.37,"divRel":0.00000238,"meanSpeed":111.4,"wallNormalMax":0,"cflMax":null}
&wind=45 {"per10s":12.9,"divRel":0.00000238,"meanSpeed":55.7,"wallNormalMax":0,"cflMax":null}
&wind=22.5 {"per10s":2.28,"divRel":0.00000238,"meanSpeed":27.8,"wallNormalMax":0,"cflMax":null}
&octaves=1 {"per10s":10.45,"divRel":0.00000216,"meanSpeed":65.3,"wallNormalMax":0,"cflMax":null}
&noiseScale=1.1 {"per10s":-45.72,"divRel":0.00000399,"meanSpeed":131.4,"wallNormalMax":0,"cflMax":null}
```
