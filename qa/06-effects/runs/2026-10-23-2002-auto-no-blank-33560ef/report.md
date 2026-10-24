# 06-lenia-effects.html · headless run 2026-10-23-2002

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 90s

QA sweep · 06-lenia-effects · 2026-10-23T20:05
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| look-dream | 4.7 | 83% | 0.1013 | ±0.0706 | 0.140 | 60.1 | keep — actually much better balance between full and empty |
| look-glow | 5.4 | 81% | 0.0924 | ±0.0644 | 0.133 | 60.1 | keep — looks quite good. maybe add some fluctuations to the cells when the screen is full - or they change color when the beats go |

queries:
- look-dream: http://127.0.0.1:34949/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=dream$x
- look-glow: http://127.0.0.1:34949/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=glow$x

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Cover over time (page's own Auto cover, sampled ~5×/s)

| variant | mean | min | time < 10% | longest < 10% | time < 3% | longest < 3% | 40→10% drops (s) |
|---|---|---|---|---|---|---|---|
| look-dream | 85.7% | 4.3% | 2.3% | 0.6 s | 0% | 0 s | keep — actually much better balance between full and empty |
| look-glow | 84.5% | 3.5% | 1.6% | 0.6 s | 0% | 0 s | keep — looks quite good. maybe add some fluctuations to the cells when the screen is full - or they change color when the beats go |

## Pairwise ranking (user picks)

2 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | look-dream | 1 | 0 | 0 | 2 |
| 2 | look-glow | 1 | 0 | 0 | 2 |
