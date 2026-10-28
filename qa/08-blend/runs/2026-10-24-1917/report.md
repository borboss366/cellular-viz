# 08-blend.html · headless run 2026-10-24-1917

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 60s

QA sweep · 08-blend · 2026-10-24T19:23
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| fade | 9.1 | 48% | 0.0655 | ±0.0314 | 0.056 | 60.1 |  |
| mask | 8.6 | 42% | 0.0710 | ±0.0375 | 0.049 | 60.1 |  |
| cut | 9.2 | 33% | 0.0606 | ±0.0336 | 0.039 | 60 |  |
| screen | 8.4 | 50% | 0.0711 | ±0.0258 | 0.037 | 60.2 |  |
| color | 8.8 | 46% | 0.0664 | ±0.0337 | 0.039 | 60 |  |
| difference | 7.9 | 62% | 0.0779 | ±0.0290 | 0.052 | 60.2 |  |

queries:
- fade: http://127.0.0.1:36337/experiments/08-blend.html?list=06:look=dream,07:preset=small-ring&hold=4&kind=fade
- mask: http://127.0.0.1:36337/experiments/08-blend.html?list=06:look=dream,07:preset=small-ring&hold=4&kind=mask
- cut: http://127.0.0.1:36337/experiments/08-blend.html?list=06:look=dream,07:preset=small-ring&hold=4&kind=cut
- screen: http://127.0.0.1:36337/experiments/08-blend.html?list=06:look=dream,07:preset=small-ring&hold=4&kind=screen
- color: http://127.0.0.1:36337/experiments/08-blend.html?list=06:look=dream,07:preset=small-ring&hold=4&kind=color
- difference: http://127.0.0.1:36337/experiments/08-blend.html?list=06:look=dream,07:preset=small-ring&hold=4&kind=difference

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Switches (08 Blend; picture sampled 4×/s, page fps 5×/s)

| variant | switches | fps hold (median / min) | fps during switch (median / min) | lit min, hold | lit min, switch | samples < 3% lit |
|---|---|---|---|---|---|---|
| fade | 6 | 60 / 60 | 60 / 60 | 11% | 20% | 0 |
| mask | 6 | 60 / 60 | 60 / 60 | 16% | 16% | 0 |
| cut | 6 | 60 / 60 | 60 / 60 | 9% | 6% | 0 |
| screen | 6 | 60 / 60 | 60 / 60 | 17% | 18% | 0 |
| color | 6 | 60 / 60 | 60 / 60 | 12% | 16% | 0 |
| difference | 6 | 60 / 60 | 60 / 60 | 25% | 29% | 0 |

## Pairwise ranking (user picks)

10 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | screen | 1.954 | 3 | 1 | 1 |
| 2 | difference | 1.722 | 2 | 1 | 1 |
| 3 | fade | 1.509 | 1 | 1 | 1 |
| 4 | color | 1.509 | 1 | 1 | 1 |
| 5 | mask | 0.398 | 0 | 1 | 1 |
| 6 | cut | 0.328 | 0 | 2 | 1 |
