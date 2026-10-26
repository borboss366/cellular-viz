# 18-little-bang.html · headless run 2026-10-26-1826

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 40s

QA sweep · 18-little-bang · 2026-10-26T18:29
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| 1-collide | 4.2 | 76% | 0.2081 | ±0.0585 | 0.015 | 60 |  — when they fly away they look like giant while spot. Maybe decrease the amount of particles? |
| 2-quench | 4.1 | 76% | 0.2062 | ±0.0579 | 0.015 | 60.4 |  |
| 3-strings | 5.7 | 1% | 0.0050 | ±0.0006 | 0.003 | 60.3 |  — quite boring. Maybe make a tube like in the particle accelerator - and the camera flies inside and sees the particles collide? |
| 4-auto | 5.7 | 46% | 0.1285 | ±0.1071 | 0.010 | 60.3 |  |

queries:
- 1-collide: http://127.0.0.1:33133/experiments/18-little-bang.html?scene=collide
- 2-quench: http://127.0.0.1:33133/experiments/18-little-bang.html?scene=quench
- 3-strings: http://127.0.0.1:33133/experiments/18-little-bang.html?scene=strings
- 4-auto: http://127.0.0.1:33133/experiments/18-little-bang.html?scene=auto

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

6 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | 1-collide | 1.686 | 1 | 0 | 2 |
| 2 | 2-quench | 1.686 | 1 | 0 | 2 |
| 3 | 4-auto | 1.686 | 1 | 0 | 2 |
| 4 | 3-strings | 0.209 | 0 | 3 | 0 |

## User notes

**On each look**

- **1-collide**: when they fly away they look like giant while spot. Maybe decrease the amount of particles?
- **3-strings**: quite boring. Maybe make a tube like in the particle accelerator - and the camera flies inside and sees the particles collide?

**On picks**

- 1-collide vs 2-quench → same: when they fly away they look like giant while spot. Maybe decrease the amount of particles?
