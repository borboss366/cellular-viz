# 18 Little Bang check · 2026-10-31-1035

| check | result | detail |
|---|---|---|
| tracks curl with r = pT/(0.3 B), B = 0.5 T | ✅ | 200 charged tracks, worst 1.3e-13% (3-point circle fit) |
| with dE/dx: local radius = r0 − k·s | ✅ | 200 tracks, worst 0.000% |
| elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ✅ | v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471) |
| fireball: short axis grows faster; hadronizes at T_c | ✅ | in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156) |
| strings: quarks = 2 + 2·breaks, white groups, energy kept | ✅ | 42 cascades, 184 breaks, worst drift 0 |
| jets: A_J = q/(2 − q) | ✅ | q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000 |
| sync from __qa.events (≤ 40 ms after the sound) | ✅ | collision 7.6 ms (n 15) · jet 7.7 ms (n 29) · pulse 8.1 ms (n 28) · crossing 7.2 ms (n 7) · pulse-arrive 7.2 ms (n 7) |
| page keeps animating | ✅ | |
| collide: < 2 % of pixels clipped in every frame of 16 s (#58) | ✅ | worst frame 0.00 % clipped (any channel ≥ 254) of 138 frames · brightest frame (mean lum 34.1 %): clipped 0.00 %, white 0.09 % · 1920×1080 |
| beamline: camera on the beam axis (< 0.35 off, every frame) | ✅ | worst 7.11e-15 over 961 frames · my circle fit to the camera path: R 24.000 (spec 24) |
| beamline: bunches cross on the downbeat, camera halted just short of the IP | ✅ | 9 crossings, bar-to-bar error ≤ 0.00 ms, lag ≤ 17.7 ms · at downbeats: 0.89–0.91 from the IP, speed ≤ 0.94 (lap mean 75.4) |
| quench: Mach cone half-angle = asin(c_s/v) ± 3° (my fit to the drawn wake) | ✅ | 0.4: 35.26° (widens to 36.76°, 15/82 frames fit) · 0.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 1.4: 36° (widens to 36.76°, 10/60 frames fit) · 1.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 2.4: 35.99° (widens to 36.76°, 10/60 frames fit) · 2.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 3.4: 35.99° (widens to 36.76°, 10/60 frames fit) · 3.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 4.4: 35.99° (widens to 36.78°, 10/60 frames fit) · 4.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 5.4: 35.99° (widens to 36.78°, 10/60 frames fit) · 5.12: 35.98° (widens to 36.76°, 10/60 frames fit) · 6.4: 35.99° (widens to 36.78°, 10/60 frames fit) · 6.12: 36° (widens to 36.76°, 10/60 frames fit) · 7.4: 35.99° (widens to 36.77°, 10/60 frames fit) · 7.12: –° (widens to –°, 0/24 frames fit) · want 35.26° |
| jets: each pair on a snare, ≤ 40 ms; escaping side narrow | ✅ | 16 pairs on steps 4/12 · lag ≤ 9.6 ms · φ spread 2.66° escaping vs 7.66° quenched (shader formula, q 0.75) |
| neon: wire brightness peaks ≤ 40 ms after each kick; its light ring arrives on the downbeat | ✅ | 35 kicks: frame-brightness peak median 11 ms (max 146) after the sound · pulse launch lag ≤ 17.7 ms · arrival vs crossing ≤ 0.00 ms |
| neon: mean hue changes ≥ 15° bar to bar on ≥ 90 % of bars | ✅ | 9 bars, steps 83.1, 46.2, 161.8, 31.7, 84.8, 44.5, 177.3, 122.7° (100 % ≥ 15°; wire pixels only (?qa=wires)) |
| no frame-to-frame brightness jump > 25 % outside drops (whole picture) | ✅ | whole picture worst 19.2 % (floor 5/255) · wires alone worst 48.5 % at bar 5.25, 23 frames over 25 % (the kick flash, reported only) |
| neon: wires ≥ 0.2 tube radius from the camera | ✅ | camera ≤ 7.1e-15 off the axis (my measure) · nearest wire 0.991 tube radii (page's breath − wobble) |
| 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ✅ | |
| errors | ✅ | none |

## Frame times (vsync)

| run | 1080p p95 / >20 ms | 1440p p95 / >20 ms | 4K p95 / >20 ms | canvas at 4K | tracks drawn |
|---|---|---|---|---|---|
| collide | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 30000 |
| collide 1M | 150 / 124 | 199.9 / 94 | 200 / 95 | 3840×2160 | 1000000 |
| quench | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 30000 |
| quench 1M | 150 / 117 | 216.6 / 91 | 216.7 / 62 | 3840×2160 | 1000000 |
| strings | — | 16.8 / 0 | — | — | 0 |
| auto | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 30000 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 4.28 · p95 5.35 · p99 7.13 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 5.74 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.1 % at 1760,800 (t 89.93 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.0044 (t 61.65 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.0245 at 480,0 (t 62.51 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.0127 at 800,0 (t 47.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1760,800 at t 89.93 s · 65 frames over 1.07 s · window mean L 0.00–0.01, 0 swings ≥ 0.02 (0.0 Hz) · flashing share > 25 % on 0 frames, peak 0 % · mean L every 3rd frame: 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.01 0.00 0.00 0.00 0.00 0.00 0.00 0.00 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1262 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 18.73 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 6, 2, 1, 0, 0 % (idle ≤ 10 % for 5 s; waited 5 s) |
