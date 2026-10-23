# 07-particle-lenia.html · headless run 2026-10-23-1851

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 60s · record 12s

QA sweep · 07-particle-lenia · 2026-10-23T18:53
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| rotor-60s | 9.3 | 31% | 0.0473 | ±0.0103 | 0.044 | 60.8 |  |
| big-60s | 9.3 | 31% | 0.0327 | ±0.0157 | 0.045 | 61.1 |  |

queries:
- rotor-60s: http://127.0.0.1:37181/experiments/07-particle-lenia.html?preset=rotor
- big-60s: http://127.0.0.1:37181/experiments/07-particle-lenia.html?preset=big

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

2 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | rotor-60s | 2.751 | 2 | 0 | 0 |
| 2 | big-60s | 0.363 | 0 | 2 | 0 |
