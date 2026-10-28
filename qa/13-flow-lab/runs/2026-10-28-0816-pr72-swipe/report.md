# 13-flow-lab · swipe run for #72: old 963f38a vs new fa3ffff

## old (963f38a)

# 13-flow-lab.html · headless run 2026-10-28-0837

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-28T08:37
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-rocks | 6.4 | 5% | 0.0086 | ±0.0014 | 0.007 | 60.3 |  |

queries:
- old-rocks: http://127.0.0.1:42215/experiments/13-flow-lab.html?preset=rocks

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (fa3ffff)

# 13-flow-lab.html · headless run 2026-10-28-0837

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-28T08:38
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-rocks | 6.2 | 5% | 0.0101 | ±0.0012 | 0.001 | 60.4 |  |

queries:
- new-rocks: http://127.0.0.1:43375/experiments/13-flow-lab.html?preset=rocks

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
