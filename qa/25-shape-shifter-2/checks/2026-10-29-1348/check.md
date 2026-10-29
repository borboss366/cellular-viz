# 25 Shape Shifter II check · 2026-10-29-1348

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 6 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: 1–2 holes per dive, each passed once (trefoil linking 2), as planned | ✅ | 10 dives, 0 off · genus-3 dives skip one hole (allowed) |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 68.258 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ✅ | fwd p99 148°/s, max 295°/s · up p99 245°/s, max 7805°/s · 209 frames > 180°/s<br>fwd peaks: 295° bar 43.317 (thread, phrase bar 3.32), 249° bar 11.325 (thread, phrase bar 3.32), 247° bar 84.308 (thread, phrase bar 4.31), 207° bar 59.358 (thread, phrase bar 3.36), 207° bar 91.358 (thread, phrase bar 3.36)<br>up peaks: 7805° bar 11.342 (thread, phrase bar 3.34), 7605° bar 59.375 (thread, phrase bar 3.37), 7418° bar 91.375 (thread, phrase bar 3.38), 957° bar 12.642 (thread, phrase bar 4.64), 602° bar 60.717 (thread, phrase bar 4.72) |
| 4c no empty picture longer than ¼ s (25-ray test) | ✅ | 0 stretches |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ✅ | mean 25.8 %, 10th percentile 12 % |
| 5 sync (≤ 40 ms) | ✅ | kick 18.1 ms (n 60) · hat 18 ms (n 119) · snare 18.1 ms (n 30) · land 17.8 ms (n 5) · attach 17.5 ms (n 1) · thread -0.8 ms (n 1) |
| passes (?passes=1, report-only) | ℹ️ | solo: {"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.5 n1200","march":"11.37/13.16/15.17 n1200","blit":"0.14/0.17/0.18 n1200"},"0.5":{"vp":"0,0,1280,720","cpu":"0.2/0.4/0.5 n1200","march":"11.22/12.56/13.56 n1200","blit":"0.16/0.18/0.18 n1200"},"0.25":{"vp":"0,0,640,360","cpu":"0.2/0.4/0.5 n1852","march":"3.63/4.81/5.26 n1851","blit":"0.16/0.17/0.17 n1851"}},"on":true,"render":[640,360],"canvas":[2560,1440],"cpuMs":{"n":3600,"p50":0.2,"p95":0.4,"p99":0.5},"marchMs":{"n":3600,"p50":5,"p95":12.32,"p99":13.75},"blitMs":{"n":3600,"p50":0.16,"p95":0.18,"p99":0.18}} · blend: {"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.6 n1200","march":"11.28/13.11/15.5 n1200","blit":"0.13/0.16/0.17 n1200"},"0.5":{"vp":"0,0,1280,720","cpu":"0.2/0.4/0.5 n1200","march":"11.22/12.45/13.33 n1200","blit":"0.15/0.17/0.17 n1200"},"0.25":{"vp":"0,0,640,360","cpu":"0.2/0.4/0.5 n1853","march":"3.63/4.79/5.21 n1852","blit":"0.15/0.16/0.19 n1852"}},"on":true,"render":[640,360],"canvas":[2560,1440],"cpuMs":{"n":3600,"p50":0.2,"p95":0.4,"p99":0.5},"marchMs":{"n":3600,"p50":5,"p95":12.24,"p99":13.56},"blitMs":{"n":3600,"p50":0.15,"p95":0.17,"p99":0.17}} |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |
| res=native | – | 16.7 / 0 | 16.8 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 11.47 · p95 13.47 · p99 16.66 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 9.98 · p95 12.08 · p99 12.96 ms over 3600 frames · rAF > 20 ms: 0 of 3599 |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | 800 MHz 49.3 % · 802 MHz 0.2 % · 812 MHz 0.2 % · 818 MHz 0.2 % · 819 MHz 0.2 % · 827 MHz 0.2 % · 830 MHz 0.2 % · 831 MHz 0.2 % · 833 MHz 0.2 % · 836 MHz 0.4 % · 843 MHz 0.2 % · 844 MHz 0.4 % · 846 MHz 0.2 % · 849 MHz 0.2 % · 851 MHz 0.2 % · 854 MHz 0.2 % · 860 MHz 0.2 % · 861 MHz 0.2 % · 863 MHz 0.2 % · 875 MHz 0.2 % · 876 MHz 0.2 % · 881 MHz 0.4 % · 885 MHz 0.2 % · 890 MHz 0.2 % · 896 MHz 0.2 % · 908 MHz 0.2 % · 913 MHz 0.2 % · 917 MHz 0.2 % · 922 MHz 0.2 % · 929 MHz 0.2 % · 932 MHz 0.2 % · 937 MHz 0.2 % · 947 MHz 0.2 % · 961 MHz 0.2 % · 966 MHz 0.2 % · 967 MHz 0.2 % · 972 MHz 0.4 % · 975 MHz 0.2 % · 976 MHz 0.4 % · 979 MHz 0.2 % · 981 MHz 0.2 % · 989 MHz 0.2 % · 990 MHz 0.2 % · 991 MHz 0.2 % · 999 MHz 0.2 % · 1001 MHz 0.2 % · 1006 MHz 0.2 % · 1007 MHz 0.2 % · 1011 MHz 0.4 % · 1012 MHz 0.2 % · 1014 MHz 0.2 % · 1017 MHz 0.4 % · 1021 MHz 0.2 % · 1022 MHz 0.6 % · 1025 MHz 0.2 % · 1028 MHz 0.2 % · 1032 MHz 0.2 % · 1033 MHz 0.2 % · 1035 MHz 0.2 % · 1038 MHz 0.2 % · 1044 MHz 0.2 % · 1053 MHz 0.2 % · 1057 MHz 0.2 % · 1061 MHz 0.2 % · 1062 MHz 0.2 % · 1066 MHz 0.2 % · 1069 MHz 0.2 % · 1071 MHz 0.4 % · 1075 MHz 0.2 % · 1076 MHz 0.2 % · 1080 MHz 0.2 % · 1085 MHz 0.2 % · 1086 MHz 0.2 % · 1090 MHz 0.2 % · 1099 MHz 0.4 % · 1106 MHz 0.2 % · 1107 MHz 0.2 % · 1112 MHz 0.2 % · 1113 MHz 0.2 % · 1115 MHz 0.4 % · 1118 MHz 0.2 % · 1122 MHz 0.6 % · 1124 MHz 0.2 % · 1131 MHz 0.2 % · 1132 MHz 0.2 % · 1136 MHz 0.2 % · 1137 MHz 0.4 % · 1138 MHz 0.2 % · 1144 MHz 0.2 % · 1146 MHz 0.2 % · 1147 MHz 0.2 % · 1148 MHz 0.2 % · 1152 MHz 0.2 % · 1153 MHz 0.2 % · 1154 MHz 0.4 % · 1159 MHz 0.2 % · 1160 MHz 0.6 % · 1168 MHz 0.2 % · 1171 MHz 0.2 % · 1172 MHz 0.2 % · 1179 MHz 0.2 % · 1180 MHz 0.2 % · 1188 MHz 0.2 % · 1189 MHz 0.4 % · 1193 MHz 0.2 % · 1197 MHz 0.4 % · 1199 MHz 0.4 % · 1210 MHz 0.2 % · 1215 MHz 0.2 % · 1220 MHz 0.4 % · 1221 MHz 0.2 % · 1225 MHz 0.2 % · 1226 MHz 0.4 % · 1228 MHz 0.2 % · 1230 MHz 0.2 % · 1232 MHz 0.2 % · 1234 MHz 0.2 % · 1239 MHz 0.2 % · 1242 MHz 0.2 % · 1243 MHz 0.2 % · 1251 MHz 0.4 % · 1253 MHz 0.4 % · 1262 MHz 0.2 % · 1266 MHz 0.2 % · 1268 MHz 0.2 % · 1273 MHz 0.2 % · 1275 MHz 0.2 % · 1280 MHz 0.2 % · 1290 MHz 0.2 % · 1292 MHz 0.2 % · 1301 MHz 0.2 % · 1310 MHz 0.2 % · 1318 MHz 0.2 % · 1340 MHz 0.2 % · 1342 MHz 0.2 % · 1343 MHz 0.2 % · 1361 MHz 0.2 % · 1369 MHz 0.2 % · 1387 MHz 0.2 % · 1394 MHz 0.2 % · 1425 MHz 0.2 % · 1467 MHz 0.4 % · 1481 MHz 0.2 % · 1502 MHz 0.2 % · 1518 MHz 0.2 % · 1538 MHz 0.2 % · 1541 MHz 0.2 % · 1552 MHz 0.2 % · 1594 MHz 0.2 % · 1605 MHz 0.2 % · 1619 MHz 0.2 % · 1621 MHz 0.2 % · 1631 MHz 0.2 % · 1662 MHz 0.2 % · 1666 MHz 0.2 % · 1674 MHz 0.2 % · 1690 MHz 0.2 % · 1707 MHz 0.2 % · 1717 MHz 0.2 % · 1721 MHz 0.2 % · 1725 MHz 0.2 % · 1735 MHz 0.2 % · 1768 MHz 0.2 % · 1793 MHz 0.2 % · 1804 MHz 0.2 % · 1809 MHz 0.2 % · 1815 MHz 0.2 % · 1817 MHz 0.2 % · 1842 MHz 0.2 % · 1850 MHz 0.2 % · 1858 MHz 0.2 % · 1863 MHz 0.2 % · 1864 MHz 0.2 % · 1866 MHz 0.2 % · 1895 MHz 0.2 % · 1898 MHz 0.2 % · 1947 MHz 0.2 % · 1962 MHz 0.2 % · 2044 MHz 0.2 % · 2106 MHz 0.2 % · 2133 MHz 0.2 % · 2143 MHz 0.2 % · 2149 MHz 0.2 % · 2163 MHz 0.2 % · 2172 MHz 0.2 % · 2188 MHz 0.2 % · 2200 MHz 0.2 % · 2202 MHz 0.2 % · 2220 MHz 0.2 % · 2252 MHz 0.2 % · 2259 MHz 0.2 % · 2337 MHz 0.2 % · 2342 MHz 0.2 % · 2348 MHz 0.2 % · 2357 MHz 0.2 % · 2401 MHz 0.2 % · 2410 MHz 0.2 % · 2415 MHz 0.2 % · 2430 MHz 0.2 % · 2463 MHz 0.2 % · 2481 MHz 0.2 % · 2511 MHz 0.2 % · 2580 MHz 0.2 % · 2597 MHz 0.2 % · 2629 MHz 0.2 % · 2641 MHz 0.2 % · 2654 MHz 0.2 % · 2661 MHz 0.2 % · 2668 MHz 0.2 % · 2678 MHz 0.2 % · 2687 MHz 0.2 % · 2691 MHz 0.2 % · 2693 MHz 0.2 % · 2700 MHz 2.4 % · power_dpm_force_performance_level auto |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5397 frames in 90.0 s (60.0 fps, 0 skipped) · tap 14.16 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 725 failing frames · worst 91.5 % at 1760,0 (t 77.45 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 1.7 % at 1920,640 (t 64.08 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1838 (t 86.08 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.5965 at 800,320 (t 6.08 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 37 failing frames · max 0.4336 at 640,480 (t 86.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.5 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 10, 4, 2, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
