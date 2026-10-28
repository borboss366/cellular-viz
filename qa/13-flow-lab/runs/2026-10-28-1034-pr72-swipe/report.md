# 13-flow-lab · swipe run for #72: old 963f38a vs new 7877b19

## old (963f38a)

# 13-flow-lab.html · headless run 2026-10-28-1054

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-28T10:55
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-rocks | 6.3 | 5% | 0.0080 | ±0.0010 | 0.007 | 60.3 |  |

queries:
- old-rocks: http://127.0.0.1:41125/experiments/13-flow-lab.html?preset=rocks

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (7877b19)

# 13-flow-lab.html · headless run 2026-10-28-1055

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-28T10:56
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-rocks | 7.7 | 45% | 0.0376 | ±0.0031 | 0.015 | 60.3 |  |

queries:
- new-rocks: http://127.0.0.1:33707/experiments/13-flow-lab.html?preset=rocks

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
