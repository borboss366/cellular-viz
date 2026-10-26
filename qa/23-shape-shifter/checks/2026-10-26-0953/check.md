# 23 Shape Shifter check · 2026-10-26-0953

Everything below is rebuilt from `__qa.sdf` with my own grid code.

| gate | result | detail |
|---|---|---|
| 1 genus constant except at the drop (my b0 + b2 − χ, n = 96, h = 0.0333) | ✅ | 62 moments; 0 wrong away from the drops · switches: 1→0 between bars 13.875 and 14, 0→1 between bars 30 and 30.125 · thinnest feature 0.022 vs h 0.0333 |
| 2 Gauss–Bonnet ∫K dA = 4π(1 − g), n = 160 (mine, ±5 %) | ❌ | bar 3 (g 1): mine 2.232·4π, page 0.235·4π, want 0 · bar 9 (g 1): mine 2.062·4π, page 0.214·4π, want 0 · bar 18 (g 0): mine 3.180·4π, page 1.514·4π, want 1 · bar 24 (g 0): mine 3.185·4π, page 1.386·4π, want 1 |
| 3 camera never inside (sdf at the eye, every 1/64 bar) | ✅ | min sdf 0.088 at bar 13.781 (fly) · 64 fly samples, 5 pushed out |
| 4 surgery event on the drop | ✅ | morph bar 8, fly bar 13, surgery bar 14, morph bar 16 |
| 5 sync from __qa.events (≤ 40 ms) | ✅ | kick 8.3 ms (n 72) · hat 8.3 ms (n 143) · snare 8.5 ms (n 36) · morph 8.4 ms (n 2) · fly 7.1 ms (n 1) · surgery 6.7 ms (n 1) |
| 60 fps 1080p/1440p/4K | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| family | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| 0 | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |
| 1 | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |
| auto | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |

## Follow-up
- Gauss–Bonnet without bumps (?bumpAmp=0, qa/history/2026-10-26-1001-probe23-gb.sh), mine / page, in units of 4π:
  - n = 160: bar 3 (g 1) 0.491 / 0.050 · bar 9 (g 1) 0.079 / 0.005 · bar 18 (g 0) 1.002 / 0.994 · bar 24 (g 0) 0.999 / 1.000
  - n = 224: bar 3 0.245 / 0.050 · bar 9 0.040 / 0.005 · bar 18 1.002 / 0.994 · bar 24 1.000 / 1.000
  - Mine converges to 4π(1 − g) as h², the bar-3 excess sits at the mug's sharp handle–body crease.
- With bumps on, neither estimate is near: mine 2.23 → 1.22 (g 1) and 3.18 → 2.24 (g 0) from n = 160 → 224, the page's 0.21–0.24 and 1.39–1.51. The bumps are finer than a 160–224 grid resolves; the integral is not checkable this way with bumps on. The genus itself is exact from χ (gate 1).
- Render cap: at 4K the canvas is 1920×1080 (res=cap). With ?res=native it renders 2560×1440 and 3840×2160 at 60 fps, p95 16.7 / 16.8 ms (qa/history/2026-10-26-1010-probe23-native.sh).
