# 10-bsd.html · headless run 2026-10-24-2042

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 20s

QA sweep · 10-bsd · 2026-10-24T20:43
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| x3+17 | 8.6 | 12% | 0.0423 | ±0.0988 | 0.018 | 60.1 | dull |
| x3-25x | 8.5 | 12% | 0.0476 | ±0.1085 | 0.018 | 59.9 | maybe — good attempt |

queries:
- x3+17: http://127.0.0.1:38437/experiments/10-bsd.html?curve=x3%2B17
- x3-25x: http://127.0.0.1:38437/experiments/10-bsd.html?curve=x3-25x

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
