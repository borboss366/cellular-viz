# 13-flow-lab · swipe run for #69: old 351304f vs new 3ddb5cb

## old (351304f)

# 13-flow-lab.html · headless run 2026-10-27-1445

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-27T14:47
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-curl | 5.9 | 3% | 0.0042 | ±0.0005 | 0.003 | 60.1 |  |
| old-plume | 5.9 | 1% | 0.0071 | ±0.0008 | 0.006 | 60.2 |  |

queries:
- old-curl: http://127.0.0.1:45783/experiments/13-flow-lab.html?preset=curl
- old-plume: http://127.0.0.1:45783/experiments/13-flow-lab.html?preset=plume

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (3ddb5cb)

# 13-flow-lab.html · headless run 2026-10-27-1447

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-27T14:48
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-curl | 6.3 | 7% | 0.0058 | ±0.0007 | 0.004 | 60.1 |  |
| new-plume | 6.9 | 6% | 0.0185 | ±0.0021 | 0.025 | 60.2 |  |

queries:
- new-curl: http://127.0.0.1:46221/experiments/13-flow-lab.html?preset=curl
- new-plume: http://127.0.0.1:46221/experiments/13-flow-lab.html?preset=plume

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
