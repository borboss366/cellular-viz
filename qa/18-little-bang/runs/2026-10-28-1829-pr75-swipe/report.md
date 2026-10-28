# 18-little-bang · swipe run for #75: old 912313e vs new 7e0a43c

## old (912313e)

# 18-little-bang.html · headless run 2026-10-28-1841

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T18:42
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-beamline | 6.4 | 43% | 0.1421 | ±0.1310 | 0.050 | 60.1 |  |

queries:
- old-beamline: http://127.0.0.1:37179/experiments/18-little-bang.html?scene=beamline

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (7e0a43c)

# 18-little-bang.html · headless run 2026-10-28-1842

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-28T18:43
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-beamline | 6.3 | 40% | 0.1312 | ±0.1190 | 0.045 | 60.2 |  |

queries:
- new-beamline: http://127.0.0.1:46421/experiments/18-little-bang.html?scene=beamline

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

2 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | new-beamline | 2.751 | 2 | 0 | 0 |
| 2 | old-beamline | 0.363 | 0 | 2 | 0 |
