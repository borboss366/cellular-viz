# 13-flow-lab.html · headless run 2026-10-25-1957

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 6s · record 40s

QA sweep · 13-flow-lab · 2026-10-25T20:02
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| 1-vortex | 6.2 | 5% | 0.0192 | ±0.0014 | 0.002 | 60 |  |
| 2-kh | 6.1 | 99% | 0.0303 | ±0.0187 | 0.007 | 60.3 |  |
| 3-plume | 6 | 2% | 0.0078 | ±0.0012 | 0.007 | 60.3 |  |
| 4-ink | 6.8 | 78% | 0.0540 | ±0.0088 | 0.015 | 60.2 |  |
| 5-rocks | 6.6 | 5% | 0.0129 | ±0.0026 | 0.008 | 60.2 |  |
| 6-curl | 6.1 | 4% | 0.0051 | ±0.0013 | 0.003 | 60.2 |  |

queries:
- 1-vortex: http://127.0.0.1:37677/experiments/13-flow-lab.html?preset=vortex
- 2-kh: http://127.0.0.1:37677/experiments/13-flow-lab.html?preset=kh
- 3-plume: http://127.0.0.1:37677/experiments/13-flow-lab.html?preset=plume
- 4-ink: http://127.0.0.1:37677/experiments/13-flow-lab.html?preset=ink
- 5-rocks: http://127.0.0.1:37677/experiments/13-flow-lab.html?preset=rocks
- 6-curl: http://127.0.0.1:37677/experiments/13-flow-lab.html?preset=curl

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

10 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | 2-kh | 8.604 | 3 | 0 | 0 |
| 2 | 4-ink | 3.233 | 3 | 1 | 0 |
| 3 | 1-vortex | 1.101 | 1 | 2 | 0 |
| 4 | 5-rocks | 0.713 | 2 | 2 | 0 |
| 5 | 6-curl | 0.385 | 1 | 2 | 0 |
| 6 | 3-plume | 0.119 | 0 | 3 | 0 |
