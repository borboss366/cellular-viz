# 07-particle-lenia.html · headless run 2026-10-23-1850

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 12s

QA sweep · 07-particle-lenia · 2026-10-23T18:51
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| rotor | 9.3 | 31% | 0.0440 | ±0.0123 | 0.043 | 60.8 | keep |
| big | 9.4 | 44% | 0.0396 | ±0.0170 | 0.046 | 61 | keep |

queries:
- rotor: http://127.0.0.1:46587/experiments/07-particle-lenia.html?preset=rotor
- big: http://127.0.0.1:46587/experiments/07-particle-lenia.html?preset=big

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

1 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | rotor | 2.13 | 1 | 0 | 0 |
| 2 | big | 0.469 | 0 | 1 | 0 |
