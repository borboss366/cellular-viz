# 11-riemann-show.html · headless run 2026-10-24-2203

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 24s

QA sweep · 11-riemann-show · 2026-10-24T22:06
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| ribbon | 7.4 | 19% | 0.0784 | ±0.0454 | 0.016 | 60.2 |  |
| march | 9.3 | 18% | 0.0317 | ±0.0380 | 0.042 | 60.2 |  |
| scope | 8.5 | 13% | 0.0479 | ±0.0361 | 0.013 | 60.2 |  |
| primes | 8.1 | 7% | 0.0191 | ±0.0349 | 0.016 | 60.3 |  |
| canyon | 6.9 | 86% | 0.0676 | ±0.0253 | 0.104 | 60.3 |  |
| map | 4.5 | 100% | 0.1040 | ±0.0331 | 0.197 | 60.3 |  |

queries:
- ribbon: http://127.0.0.1:43319/experiments/11-riemann-show.html?scene=ribbon
- march: http://127.0.0.1:43319/experiments/11-riemann-show.html?scene=march
- scope: http://127.0.0.1:43319/experiments/11-riemann-show.html?scene=scope
- primes: http://127.0.0.1:43319/experiments/11-riemann-show.html?scene=primes
- canyon: http://127.0.0.1:43319/experiments/11-riemann-show.html?scene=canyon
- map: http://127.0.0.1:43319/experiments/11-riemann-show.html?scene=map

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

10 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | ribbon | 7.595 | 3 | 0 | 0 |
| 2 | scope | 2.42 | 2 | 1 | 0 |
| 3 | canyon | 1.132 | 2 | 2 | 0 |
| 4 | march | 0.557 | 1 | 1 | 1 |
| 5 | map | 0.399 | 1 | 2 | 0 |
| 6 | primes | 0.216 | 0 | 3 | 1 |
