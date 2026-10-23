# 06-lenia-effects.html · headless run 2026-10-23-1539

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 4s · record 12s

QA sweep · 06-lenia-effects · 2026-10-23T15:41
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| clean | 9.7 | 28% | 0.0343 | ±0.0392 | 0.063 | 60.6 |  |
| bloom-mid | 10 | 36% | 0.0381 | ±0.0390 | 0.085 | 60.5 |  |
| emboss | 9.5 | 23% | 0.0218 | ±0.0208 | 0.053 | 60.6 |  |
| palette | 8.6 | 24% | 0.0307 | ±0.0382 | 0.006 | 60.6 |  |
| trails | 10 | 41% | 0.0406 | ±0.0441 | 0.092 | 60.5 |  |
| bulge | 9.9 | 26% | 0.0565 | ±0.0525 | 0.072 | 60.5 |  |
| look-glow | 9.5 | 46% | 0.0485 | ±0.0398 | 0.055 | 60.5 |  |
| look-chrome | 8.6 | 34% | 0.0270 | ±0.0321 | 0.007 | 60.6 |  |
| look-dream | 9.1 | 47% | 0.0473 | ±0.0497 | 0.031 | 60.5 |  |
| look-pulse | 9.2 | 35% | 0.0605 | ±0.0688 | 0.042 | 60.6 |  |

queries:
- clean: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean
- bloom-mid: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxBloom=0.6&fxBloomBeat=1
- emboss: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxEmboss=0.7&fxSheen=0.5
- palette: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxPal=2&fxPalDrift=1
- trails: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxZoom=1.012&fxDecay=0.96
- bulge: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxBulge=0.6
- look-glow: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=glow
- look-chrome: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=chrome
- look-dream: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=dream
- look-pulse: http://127.0.0.1:44473/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=pulse

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

25 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | look-dream | 5.7 | 3 | 0 | 1 |
| 2 | trails | 3.455 | 2 | 0 | 3 |
| 3 | look-glow | 3.378 | 3 | 1 | 1 |
| 4 | palette | 1.481 | 3 | 2 | 1 |
| 5 | look-pulse | 1.268 | 2 | 2 | 1 |
| 6 | bulge | 0.884 | 2 | 1 | 2 |
| 7 | bloom-mid | 0.401 | 1 | 3 | 1 |
| 8 | look-chrome | 0.356 | 1 | 2 | 1 |
| 9 | emboss | 0.275 | 1 | 3 | 1 |
| 10 | clean | 0.23 | 1 | 5 | 0 |
