# 14-round-point · swipe run for #68: old 351304f vs new 24d52a7

## old (351304f)

# 14-round-point.html · headless run 2026-10-27-1812

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 14-round-point · 2026-10-27T18:12
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-auto | 8.3 | 11% | 0.0065 | ±0.0124 | 0.014 | 60.1 |  |

queries:
- old-auto: http://127.0.0.1:44061/experiments/14-round-point.html?scene=auto

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (24d52a7)

# 14-round-point.html · headless run 2026-10-27-1812

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 14-round-point · 2026-10-27T18:13
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-auto | 8 | 11% | 0.0078 | ±0.0077 | 0.013 | 60.1 |  |

queries:
- new-auto: http://127.0.0.1:41403/experiments/14-round-point.html?scene=auto

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
