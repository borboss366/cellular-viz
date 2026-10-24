# 06-lenia-effects.html · headless run 2026-10-23-1944

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 90s

QA sweep · 06-lenia-effects · 2026-10-23T19:47
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| look-dream | 6.7 | 100% | 0.0709 | ±0.0284 | 0.094 | 60.1 |  |
| look-glow | 4.5 | 96% | 0.1109 | ±0.0771 | 0.163 | 60.1 |  |

queries:
- look-dream: http://127.0.0.1:43087/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=dream
- look-glow: http://127.0.0.1:43087/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=glow

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Cover over time (page's own Auto cover, sampled ~5×/s)

| variant | mean | min | time < 10% | longest < 10% | time < 3% | longest < 3% | 40→10% drops (s) |
|---|---|---|---|---|---|---|---|
| look-dream | 98.5% | 92.2% | 0% | 0 s | 0% | 0 s | — |
| look-glow | 98.4% | 93.4% | 0% | 0 s | 0% | 0 s | — |
