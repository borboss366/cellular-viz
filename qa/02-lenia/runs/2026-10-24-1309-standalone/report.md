# 02-lenia.html · headless run 2026-10-24-1309

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 10s

QA sweep · 02-lenia · 2026-10-24T13:09
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| alone | 9.5 | 20% | 0.0217 | ±0.0164 | 0.055 | 60.5 |  |

queries:
- alone: http://127.0.0.1:32975/experiments/02-lenia.html?bpm=120&muted=1&hud=short

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Cover over time (page's own Auto cover, sampled ~5×/s)

| variant | mean | min | time < 10% | longest < 10% | time < 3% | longest < 3% | 40→10% drops (s) |
|---|---|---|---|---|---|---|---|
| alone | -100% | -100% | 100% | 9.8 s | 100% | 9.8 s | — |
