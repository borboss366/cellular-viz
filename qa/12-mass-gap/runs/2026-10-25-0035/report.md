# 12-mass-gap.html · headless run 2026-10-25-0035

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 24s

QA sweep · 12-mass-gap · 2026-10-25T00:37
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| field | 7.6 | 84% | 0.0431 | ±0.0561 | 0.090 | 60.2 | keep |
| tube | 7.5 | 10% | 0.0058 | ±0.0049 | 0.016 | 60.2 |  |
| glueball | 7.7 | 7% | 0.0086 | ±0.0064 | 0.025 | 60.2 |  |
| lava | 9.7 | 28% | 0.0215 | ±0.0078 | 0.080 | 60.1 |  |

queries:
- field: http://127.0.0.1:42661/experiments/12-mass-gap.html?scene=field&bars=4
- tube: http://127.0.0.1:42661/experiments/12-mass-gap.html?scene=tube&bars=4
- glueball: http://127.0.0.1:42661/experiments/12-mass-gap.html?scene=glueball&bars=4
- lava: http://127.0.0.1:42661/experiments/12-mass-gap.html?scene=lava

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

6 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | field | 5.815 | 2 | 0 | 0 |
| 2 | lava | 1.766 | 2 | 1 | 0 |
| 3 | tube | 0.725 | 2 | 2 | 0 |
| 4 | glueball | 0.134 | 0 | 3 | 0 |
