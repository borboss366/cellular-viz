# 06-lenia-effects.html · headless run 2026-10-23-1500

- box: 3a51036815f5 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: none (SwiftShader software GL)
- Chromium 156.0.8078.4 · ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
- warm-up 4s · record 12s
- ⚠ fps is software-rendered and says nothing about the phone

QA sweep · 06-lenia-effects · 2026-10-23T15:03
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| clean | 8.2 | 20% | 0.0231 | ±0.0180 | 0.061 | 15.9 |  |
| bloom-mid | 8.5 | 42% | 0.0528 | ±0.0434 | 0.072 | 16 |  |
| emboss | 8.1 | 41% | 0.0347 | ±0.0363 | 0.054 | 15.5 |  |
| palette | 7.4 | 41% | 0.0575 | ±0.0318 | 0.017 | 16.2 |  |
| trails | 8.2 | 42% | 0.0280 | ±0.0128 | 0.062 | 15.9 |  |
| bulge | 6 | 3% | 0.0091 | ±0.0038 | 0.056 | 15.8 |  |
| look-glow | 8.3 | 43% | 0.0561 | ±0.0487 | 0.061 | 16.5 |  |
| look-chrome | 7 | 56% | 0.0639 | ±0.0680 | 0.015 | 15.5 |  |
| look-dream | 8.1 | 52% | 0.0385 | ±0.0134 | 0.048 | 16.5 |  |
| look-pulse | 6.1 | 9% | 0.0145 | ±0.0058 | 0.012 | 15.9 |  |

queries:
- clean: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean
- bloom-mid: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxBloom=0.6&fxBloomBeat=1
- emboss: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxEmboss=0.7&fxSheen=0.5
- palette: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxPal=2&fxPalDrift=1
- trails: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxZoom=1.012&fxDecay=0.96
- bulge: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=clean&fxBulge=0.6
- look-glow: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=glow
- look-chrome: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=chrome
- look-dream: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=dream
- look-pulse: http://127.0.0.1:34921/experiments/06-lenia-effects.html?preset=four&sigma=0.02&look=pulse

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).
