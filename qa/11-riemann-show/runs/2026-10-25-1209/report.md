# 11-riemann-show.html · headless run 2026-10-25-1209

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 45s

QA sweep · 11-riemann-show · 2026-10-25T12:10
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| canyon-main | 4.5 | 85% | 0.1844 | ±0.0697 | 0.115 | 60.2 |  |
| ribbon-main | 6.5 | 22% | 0.0905 | ±0.0559 | 0.015 | 60 |  |

queries:
- canyon-main: http://127.0.0.1:41123/experiments/11-riemann-show.html?scene=canyon
- ribbon-main: http://127.0.0.1:41123/experiments/11-riemann-show.html?scene=ribbon

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

2 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | canyon-main | 1 | 0 | 0 | 2 |
| 2 | ribbon-main | 1 | 0 | 0 | 2 |
