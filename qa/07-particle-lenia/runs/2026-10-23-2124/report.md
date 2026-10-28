# 07-particle-lenia.html · headless run 2026-10-23-2124

- box: 3adc2b2ec197 · AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
- GPU: /dev/dri/renderD128 (ANGLE gl-egl, Mesa)
- Chromium 156.0.8078.4 · ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- warm-up 20s · record 20s

QA sweep · 07-particle-lenia · 2026-10-23T21:33
| variant | score | cover | motion | pulse | colour | fps | verdict |
|---|---|---|---|---|---|---|---|
| rotor-ref | 9.3 | 31% | 0.0483 | ±0.0118 | 0.044 | 60.2 |  |
| dense | 9.3 | 30% | 0.0413 | ±0.0145 | 0.042 | 60.1 |  |
| tight | 8.2 | 22% | 0.0357 | ±0.0053 | 0.019 | 60.1 |  |
| loose | 10 | 48% | 0.0403 | ±0.0281 | 0.090 | 60 |  |
| soft-rep | 9.4 | 30% | 0.0389 | ±0.0100 | 0.050 | 60.2 |  |
| hard-rep | 9.1 | 30% | 0.0405 | ±0.0158 | 0.032 | 60.1 |  |
| picky | 8.6 | 21% | 0.0336 | ±0.0088 | 0.013 | 60.1 |  |
| tolerant | 9.9 | 45% | 0.0372 | ±0.0183 | 0.077 | 60.1 |  |
| wide-ring | 9.4 | 43% | 0.0348 | ±0.0121 | 0.046 | 60.2 |  |
| small-ring | 9.2 | 29% | 0.0391 | ±0.0116 | 0.039 | 60.1 |  |
| swarm-400 | 9.3 | 31% | 0.0393 | ±0.0144 | 0.045 | 60.4 |  |
| rotor-break | 9.2 | 31% | 0.0458 | ±0.0089 | 0.046 | 60.1 |  |

queries:
- rotor-ref: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor
- dense: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&N=300
- tight: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&muG=0.7&sigG=0.12
- loose: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&muG=0.45&sigG=0.2
- soft-rep: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&rep=0.5
- hard-rep: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&rep=1.8
- picky: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&sigG=0.08
- tolerant: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&sigG=0.25
- wide-ring: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&muK=5&sigK=1.5&wK=0.012
- small-ring: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&muK=3&sigK=0.7&wK=0.04
- swarm-400: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&N=400&muK=5.66&sigK=1.41&wK=0.011
- rotor-break: http://127.0.0.1:41785/experiments/07-particle-lenia.html?preset=rotor&groove=break&mKickBurst=1

Stills: `stills/` · videos stay on the box (`videos/`, git-ignored).

## Pairwise ranking (user picks)

55 picks, Bradley–Terry strength (1 = average).

| # | variant | strength | won | lost | tie |
|---|---|---|---|---|---|
| 1 | small-ring | 37.623 | 5 | 0 | 0 |
| 2 | dense | 8.431 | 6 | 2 | 0 |
| 3 | loose | 2.658 | 5 | 3 | 0 |
| 4 | hard-rep | 1.805 | 7 | 4 | 0 |
| 5 | rotor-break | 1.085 | 5 | 4 | 2 |
| 6 | swarm-400 | 0.949 | 5 | 4 | 1 |
| 7 | tolerant | 0.947 | 5 | 5 | 0 |
| 8 | rotor-ref | 0.671 | 5 | 5 | 0 |
| 9 | tight | 0.373 | 4 | 7 | 0 |
| 10 | soft-rep | 0.319 | 3 | 6 | 1 |
| 11 | wide-ring | 0.22 | 3 | 7 | 0 |
| 12 | picky | 0.038 | 0 | 6 | 0 |
