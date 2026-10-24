# 08-blend.html · headless run 2026-10-24-1305

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 60s

QA sweep · 08-blend · 2026-10-24T13:07
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| density-hold4 | 9 | 13% | 0.0337 | ±0.0384 | 0.037 | 60.3 |  |
| fade-hold4 | 8.4 | 8% | 0.0231 | ±0.0218 | 0.034 | 60.2 |  |

queries:
- density-hold4: http://127.0.0.1:42219/experiments/08-blend.html?hold=4&kind=density
- fade-hold4: http://127.0.0.1:42219/experiments/08-blend.html?hold=4&kind=fade

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Switches (08 Blend; picture sampled 4×/s, page fps 5×/s)

| variant | switches | fps hold (median / min) | fps during switch (median / min) | lit min, hold | lit min, switch | samples < 3% lit |
|---|---|---|---|---|---|---|
| density-hold4 | 6 | 60 / 60 | 60 / 60 | 2% | 2% | 38 |
| fade-hold4 | 6 | 60 / 60 | 60 / 60 | 1% | 1% | 60 |

## Pairwise ranking (user picks)

1 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | density-hold4 | 2.13 | 1 | 0 | 0 |
| 2 | fade-hold4 | 0.469 | 0 | 1 | 0 |
