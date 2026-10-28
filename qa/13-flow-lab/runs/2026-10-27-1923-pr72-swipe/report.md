# 13-flow-lab · swipe run for #72: old 963f38a vs new e5b1a9c

## old (963f38a)

# 13-flow-lab.html · headless run 2026-10-27-1944

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-27T19:44
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-rocks | 6.3 | 5% | 0.0079 | ±0.0011 | 0.007 | 60.2 | dull |

queries:
- old-rocks: http://127.0.0.1:36001/experiments/13-flow-lab.html?preset=rocks

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (e5b1a9c)

# 13-flow-lab.html · headless run 2026-10-27-1944

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-27T19:45
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-rocks | 6.2 | 4% | 0.0058 | ±0.0012 | 0.005 | 60.2 | maybe — Need more fluid coming |

queries:
- new-rocks: http://127.0.0.1:42251/experiments/13-flow-lab.html?preset=rocks

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

3 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | new-rocks | 3.224 | 3 | 0 | 0 |
| 2 | old-rocks | 0.31 | 0 | 3 | 0 |

## User notes

**On each look**

- **new-rocks** (maybe): Need more fluid coming

