# 18-little-bang · swipe run for #75: old 9311bdb vs new b0cfb63

## old (9311bdb)

# 18-little-bang.html · headless run 2026-10-28-1824

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T18:26
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-beamline | 6.4 | 41% | 0.1436 | ±0.1345 | 0.046 | 60.1 |  |
| old-quench | 6.2 | 68% | 0.1731 | ±0.0421 | 0.101 | 60.1 |  |

queries:
- old-beamline: http://127.0.0.1:41739/experiments/18-little-bang.html?scene=beamline
- old-quench: http://127.0.0.1:41739/experiments/18-little-bang.html?scene=quench

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (b0cfb63)

# 18-little-bang.html · headless run 2026-10-28-1826

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T18:27
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-beamline | 6.4 | 43% | 0.1417 | ±0.1321 | 0.050 | 60.1 |  |
| new-quench | 6.2 | 68% | 0.1724 | ±0.0426 | 0.102 | 60.1 |  |

queries:
- new-beamline: http://127.0.0.1:42973/experiments/18-little-bang.html?scene=beamline
- new-quench: http://127.0.0.1:42973/experiments/18-little-bang.html?scene=quench

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
