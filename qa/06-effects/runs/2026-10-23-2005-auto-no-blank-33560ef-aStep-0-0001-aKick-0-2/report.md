# 06-lenia-effects.html · headless run 2026-10-23-2005

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 90s

QA sweep · 06-lenia-effects · 2026-10-23T20:09
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| look-dream | 5 | 80% | 0.1015 | ±0.0728 | 0.135 | 60.1 |  |
| look-glow | 5.1 | 82% | 0.0956 | ±0.0686 | 0.135 | 60.1 |  |

queries:
- look-dream: http://127.0.0.1:36783/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=dream$x
- look-glow: http://127.0.0.1:36783/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=glow$x

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Cover over time (page's own Auto cover, sampled ~5×/s)

| variant | mean | min | time < 10% | longest < 10% | time < 3% | longest < 3% | 40→10% drops (s) |
|---|---|---|---|---|---|---|---|
| look-dream | 83.2% | 1.9% | 2.3% | 0.6 s | 0.7% | 0.4 s | 0.6, 0.8, 0.4, 0.6, 0.8 |
| look-glow | 85.2% | 5.9% | 1.4% | 0.4 s | 0% | 0 s | 0.6, 0.6, 0.8, 0.6, 0.8 |
