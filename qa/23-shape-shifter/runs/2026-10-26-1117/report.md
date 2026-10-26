# 23-shape-shifter.html · headless run 2026-10-26-1117

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 2s · record 64s

QA sweep · 23-shape-shifter · 2026-10-26T11:21
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| 1-auto | 8.1 | 7% | 0.0081 | ±0.0199 | 0.022 | 60.1 |  |
| 2-one-hole | 6.9 | 6% | 0.0048 | ±0.0029 | 0.023 | 60.2 |  |
| 3-no-hole | 6.6 | 5% | 0.0033 | ±0.0015 | 0.023 | 60.2 |  |
| 4-auto-native | 8.1 | 7% | 0.0074 | ±0.0160 | 0.022 | 60.2 |  |

queries:
- 1-auto: http://127.0.0.1:45345/experiments/23-shape-shifter.html?family=auto
- 2-one-hole: http://127.0.0.1:45345/experiments/23-shape-shifter.html?family=1
- 3-no-hole: http://127.0.0.1:45345/experiments/23-shape-shifter.html?family=0
- 4-auto-native: http://127.0.0.1:45345/experiments/23-shape-shifter.html?family=auto&res=native

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
