# 16-hodge-kaleidoscope · swipe run for #84: old 2fcb554 vs new 8589927

## old (2fcb554)

# 16-hodge-kaleidoscope.html · headless run 2026-10-29-0356

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 16-hodge-kaleidoscope · 2026-10-29T03:58
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| old-auto | 6.6 | 100% | 0.0250 | ±0.0042 | 0.125 | 60.1 |  |
| old-fastest | 6.7 | 100% | 0.0282 | ±0.0046 | 0.126 | 60.1 |  |
| old-trigger-kick | 6.6 | 100% | 0.0250 | ±0.0042 | 0.125 | 60.1 |  |

queries:
- old-auto: http://127.0.0.1:39287/experiments/16-hodge-kaleidoscope.html
- old-fastest: http://127.0.0.1:39287/experiments/16-hodge-kaleidoscope.html?hold=0.5&bpm=140
- old-trigger-kick: http://127.0.0.1:39287/experiments/16-hodge-kaleidoscope.html?autoTrigger=3

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## new (8589927)

# 16-hodge-kaleidoscope.html · headless run 2026-10-29-0358

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 16-hodge-kaleidoscope · 2026-10-29T04:01
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| new-auto | 6.8 | 100% | 0.0270 | ±0.0052 | 0.122 | 60.1 |  — Good |
| new-fastest | 7.1 | 100% | 0.0377 | ±0.0073 | 0.120 | 60.1 |  — This one is better . I like the fastest one. |
| new-trigger-kick | 6.8 | 100% | 0.0270 | ±0.0052 | 0.122 | 60.1 |  — Good |

queries:
- new-auto: http://127.0.0.1:33135/experiments/16-hodge-kaleidoscope.html
- new-fastest: http://127.0.0.1:33135/experiments/16-hodge-kaleidoscope.html?hold=0.5&bpm=140
- new-trigger-kick: http://127.0.0.1:33135/experiments/16-hodge-kaleidoscope.html?autoTrigger=3

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

10 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | new-fastest | 7.293 | 3 | 0 | 0 |
| 2 | new-auto | 1.681 | 2 | 1 | 1 |
| 3 | new-trigger-kick | 1.411 | 1 | 1 | 1 |
| 4 | old-trigger-kick | 0.396 | 0 | 1 | 2 |
| 5 | old-fastest | 0.386 | 0 | 1 | 2 |
| 6 | old-auto | 0.379 | 0 | 2 | 2 |

## User notes

**On each look**

- **new-auto**: Good
- **new-fastest**: This one is better . I like the fastest one.
- **new-trigger-kick**: Good

