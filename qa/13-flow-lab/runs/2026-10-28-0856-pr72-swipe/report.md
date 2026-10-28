# 13-flow-lab · swipe run for #72: old 963f38a vs new d6a5e02

## old (963f38a)

# 13-flow-lab.html · headless run 2026-10-28-0917

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-28T09:18
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-rocks | 6.3 | 5% | 0.0086 | ±0.0013 | 0.007 | 60.2 |  |

queries:
- old-rocks: http://127.0.0.1:36931/experiments/13-flow-lab.html?preset=rocks

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (d6a5e02)

# 13-flow-lab.html · headless run 2026-10-28-0918

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-28T09:19
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-rocks | 6.2 | 5% | 0.0105 | ±0.0012 | 0.001 | 60.3 |  |

queries:
- new-rocks: http://127.0.0.1:43159/experiments/13-flow-lab.html?preset=rocks

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
