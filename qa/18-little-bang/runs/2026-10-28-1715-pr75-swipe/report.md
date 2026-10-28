# 18-little-bang · swipe run for #75: old 9311bdb vs new 3da9d48

## old (9311bdb)

# 18-little-bang.html · headless run 2026-10-28-1726

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T17:28
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-beamline | 6.4 | 40% | 0.1430 | ±0.1369 | 0.047 | 60.1 |  |
| old-quench | 6.2 | 68% | 0.1732 | ±0.0413 | 0.102 | 60.1 |  |

queries:
- old-beamline: http://127.0.0.1:34079/experiments/18-little-bang.html?scene=beamline
- old-quench: http://127.0.0.1:34079/experiments/18-little-bang.html?scene=quench

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (3da9d48)

# 18-little-bang.html · headless run 2026-10-28-1728

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T17:29
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-beamline | 6.5 | 43% | 0.1419 | ±0.1334 | 0.051 | 60.1 |  |
| new-quench | 6.2 | 68% | 0.1726 | ±0.0430 | 0.102 | 60.1 |  |

queries:
- new-beamline: http://127.0.0.1:36031/experiments/18-little-bang.html?scene=beamline
- new-quench: http://127.0.0.1:36031/experiments/18-little-bang.html?scene=quench

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
