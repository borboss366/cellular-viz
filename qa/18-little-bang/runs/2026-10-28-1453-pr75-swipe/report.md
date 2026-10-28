# 18-little-bang · swipe run for #75: old 9311bdb vs new 912313e

## old (9311bdb)

# 18-little-bang.html · headless run 2026-10-28-1503

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T15:05
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-beamline | 6.4 | 41% | 0.1427 | ±0.1340 | 0.046 | 60.2 |  |
| old-quench | 6.2 | 68% | 0.1730 | ±0.0411 | 0.102 | 60.1 |  |

queries:
- old-beamline: http://127.0.0.1:33481/experiments/18-little-bang.html?scene=beamline
- old-quench: http://127.0.0.1:33481/experiments/18-little-bang.html?scene=quench

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (912313e)

# 18-little-bang.html · headless run 2026-10-28-1505

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T15:06
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-beamline | 6.4 | 43% | 0.1404 | ±0.1314 | 0.050 | 60.1 |  |
| new-quench | 6.2 | 68% | 0.1727 | ±0.0433 | 0.102 | 60.1 |  |

queries:
- new-beamline: http://127.0.0.1:40297/experiments/18-little-bang.html?scene=beamline
- new-quench: http://127.0.0.1:40297/experiments/18-little-bang.html?scene=quench

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
