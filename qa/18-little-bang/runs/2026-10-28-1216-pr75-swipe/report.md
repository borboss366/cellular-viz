# 18-little-bang · swipe run for #75: old 076df13 vs new 9311bdb

## old (076df13)

# 18-little-bang.html · headless run 2026-10-28-1225

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T12:27
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-beamline | 6.7 | 41% | 0.1070 | ±0.0864 | 0.061 | 60.1 |  |
| old-quench | 6.2 | 68% | 0.1731 | ±0.0418 | 0.101 | 60.1 |  |

queries:
- old-beamline: http://127.0.0.1:37107/experiments/18-little-bang.html?scene=beamline
- old-quench: http://127.0.0.1:37107/experiments/18-little-bang.html?scene=quench

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (9311bdb)

# 18-little-bang.html · headless run 2026-10-28-1227

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T12:28
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-beamline | 6.4 | 41% | 0.1434 | ±0.1342 | 0.046 | 60.1 |  — Good! But i would add the camera flying through the accelerator |
| new-quench | 6.1 | 69% | 0.1734 | ±0.0425 | 0.101 | 60.1 |  |

queries:
- new-beamline: http://127.0.0.1:36861/experiments/18-little-bang.html?scene=beamline
- new-quench: http://127.0.0.1:36861/experiments/18-little-bang.html?scene=quench

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

6 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | new-quench | 4.601 | 2 | 0 | 0 |
| 2 | new-beamline | 1.588 | 2 | 1 | 0 |
| 3 | old-quench | 0.38 | 0 | 1 | 2 |
| 4 | old-beamline | 0.36 | 0 | 2 | 2 |

## User notes

**On each look**

- **new-beamline**: Good! But i would add the camera flying through the accelerator

