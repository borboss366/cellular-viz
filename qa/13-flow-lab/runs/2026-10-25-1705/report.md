# 13-flow-lab.html · headless run 2026-10-25-1705

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 6s · record 40s

QA sweep · 13-flow-lab · 2026-10-25T17:10
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| 1-vortex | 5.7 | 1% | 0.0039 | ±0.0010 | 0.000 | 60.3 |  |
| 2-kh | 6.1 | 98% | 0.0303 | ±0.0154 | 0.007 | 60.3 |  |
| 3-plume | 6 | 2% | 0.0081 | ±0.0013 | 0.007 | 60.3 |  — make it brighter |
| 4-ink | 8.3 | 44% | 0.0423 | ±0.0072 | 0.014 | 60.3 |  |
| 5-rocks | 6.6 | 5% | 0.0129 | ±0.0031 | 0.009 | 60.2 |  — make rocks more interesting and not just simple circles, add more flow and make it more contrast |
| 6-curl | 6 | 2% | 0.0053 | ±0.0014 | 0.005 | 60.3 |  — make this a bit brighter |

queries:
- 1-vortex: http://127.0.0.1:40883/experiments/13-flow-lab.html?preset=vortex
- 2-kh: http://127.0.0.1:40883/experiments/13-flow-lab.html?preset=kh
- 3-plume: http://127.0.0.1:40883/experiments/13-flow-lab.html?preset=plume
- 4-ink: http://127.0.0.1:40883/experiments/13-flow-lab.html?preset=ink
- 5-rocks: http://127.0.0.1:40883/experiments/13-flow-lab.html?preset=rocks
- 6-curl: http://127.0.0.1:40883/experiments/13-flow-lab.html?preset=curl

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

10 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | 4-ink | 5.139 | 2 | 0 | 1 |
| 2 | 2-kh | 4.72 | 2 | 0 | 1 |
| 3 | 6-curl | 1.434 | 2 | 2 | 0 |
| 4 | 3-plume | 0.782 | 2 | 2 | 0 |
| 5 | 5-rocks | 0.317 | 1 | 3 | 0 |
| 6 | 1-vortex | 0.116 | 0 | 2 | 0 |

## User notes

**On each look**

- **3-plume**: make it brighter
- **5-rocks**: make rocks more interesting and not just simple circles, add more flow and make it more contrast
- **6-curl**: make this a bit brighter

**On picks**

- 2-kh vs 6-curl → 2-kh: both are good.
