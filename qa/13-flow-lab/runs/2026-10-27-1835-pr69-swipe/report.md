# 13-flow-lab · swipe run for #69: old 351304f vs new 3907937

## old (351304f)

# 13-flow-lab.html · headless run 2026-10-27-1856

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-27T18:57
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-curl | 5.9 | 3% | 0.0042 | ±0.0005 | 0.003 | 60.1 |  |
| old-plume | 5.9 | 1% | 0.0071 | ±0.0008 | 0.006 | 60.3 |  |

queries:
- old-curl: http://127.0.0.1:35071/experiments/13-flow-lab.html?preset=curl
- old-plume: http://127.0.0.1:35071/experiments/13-flow-lab.html?preset=plume

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (3907937)

# 13-flow-lab.html · headless run 2026-10-27-1857

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 13-flow-lab · 2026-10-27T18:59
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-curl | 6.3 | 7% | 0.0058 | ±0.0007 | 0.004 | 60.1 |  — Better |
| new-plume | 6.9 | 6% | 0.0192 | ±0.0023 | 0.025 | 60.2 |  |

queries:
- new-curl: http://127.0.0.1:38535/experiments/13-flow-lab.html?preset=curl
- new-plume: http://127.0.0.1:38535/experiments/13-flow-lab.html?preset=plume

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

6 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | new-plume | 4.083 | 2 | 0 | 0 |
| 2 | new-curl | 0.962 | 1 | 1 | 1 |
| 3 | old-plume | 0.575 | 0 | 1 | 3 |
| 4 | old-curl | 0.443 | 0 | 1 | 2 |

## User notes

**On each look**

- **new-curl**: Better

