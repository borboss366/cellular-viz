# 06-lenia-effects.html · headless run 2026-10-23-1936

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 90s

QA sweep · 06-lenia-effects · 2026-10-23T19:39
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| look-dream | 9.3 | 47% | 0.0568 | ±0.0459 | 0.043 | 60.1 |  |
| look-glow | 9.5 | 36% | 0.0498 | ±0.0564 | 0.053 | 60.1 |  |

queries:
- look-dream: http://127.0.0.1:33575/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=dream
- look-glow: http://127.0.0.1:33575/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=glow

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Cover over time (page's own Auto cover, sampled ~5×/s)

| variant | mean | min | time < 10% | longest < 10% | time < 3% | longest < 3% | 40→10% drops (s) |
|---|---|---|---|---|---|---|---|
| look-dream | 39.9% | 0% | 44.1% | 7.8 s | 31.1% | 5.8 s | 0.6, 0.4, 0.8, 0.4, 0.6, 0.6 |
| look-glow | 39.7% | 0% | 45.7% | 7.6 s | 35.8% | 5.7 s | 0.6, 0.4, 0.6, 0.4, 0.6, 0.6 |
