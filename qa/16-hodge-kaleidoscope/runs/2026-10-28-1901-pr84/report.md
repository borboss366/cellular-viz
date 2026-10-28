# 16-hodge-kaleidoscope · #84 @2fcb554

16b Hodge Kaleidoscope (spec #37 comment 6444942841): the Hodge diamond as kaleidoscope cell. Truths: numbers = spec table, Hodge symmetry + Serre duality, row sums = Betti, Euler, rendered row glow ∝ Betti within 1 %.

10/10 gates pass · warm-up 4 s · 12 s per run · swipe run `qa/16-hodge-kaleidoscope/runs/2026-10-28-1901-pr84-swipe`

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | clip | clip.mean | lum.mean | lum.min | lum.max | errors | gpuBusy | value.tableOk | value.symmetric | value.bettiOk | value.eulerOk | value.glowErr | value.preset |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| auto@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 28.27 | 27.37 | 29.27 | 0 | 0 | true | true | true | true | 0.00000699962 | "k3" |
| auto@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 28.39 | 27.48 | 29.34 | 0 | 1 | true | true | true | true | 0.00000699962 | "k3" |
| k3-flat@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 28.32 | 27.4 | 29.04 | 0 | 2 | true | true | true | true | 0.00000699962 | "k3" |
| k3-flat@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 28.46 | 27.43 | 29.15 | 0 | 0 | true | true | true | true | 0.00000699962 | "k3" |
| quintic-flat@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 27.65 | 27.15 | 28.14 | 0 | 2 | true | true | true | true | 0.0000328628 | "quintic" |
| quintic-flat@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 27.77 | 27.3 | 28.24 | 0 | 1 | true | true | true | true | 0.0000328628 | "quintic" |
| curve3-flat@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 30.04 | 29.39 | 30.77 | 0 | 2 | true | true | true | true | 2.32933e-8 | "curve" |
| curve3-flat@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 30.17 | 29.51 | 30.9 | 0 | 0 | true | true | true | true | 2.32933e-8 | "curve" |

- ✅ QA 1: numbers equal the spec's table (all presets, curve g = 0–6) · auto@1080p true · auto@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat@4k true
- ✅ QA 2: h^{p,q} = h^{q,p} and h^{p,q} = h^{n−p,n−q} · auto@1080p true · auto@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat@4k true
- ✅ QA 3: row sums = Betti numbers · auto@1080p true · auto@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat@4k true
- ✅ QA 4: rendered row glow (linear, L_k = 1) ∝ Betti within 1 % · auto@1080p 0 · auto@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0
- ✅ QA 5: Euler characteristic 2−2g / 24 / −200 / +200 · auto@1080p true · auto@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat@4k true
- ✅ fps.p05 ≥ 55 · auto@1080p 59.88 · auto@4k 59.52 · k3-flat@1080p 59.52 · k3-flat@4k 59.88 · quintic-flat@1080p 59.88 · quintic-flat@4k 59.52 · curve3-flat@1080p 59.52 · curve3-flat@4k 59.88
- ✅ longFrames ≤ 0.5 · auto@1080p 0 · auto@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0
- ✅ errors ≤ 0 · auto@1080p 0 · auto@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0
- ✅ gpuBusy ≤ 10 · auto@1080p 0 · auto@4k 1 · k3-flat@1080p 2 · k3-flat@4k 0 · quintic-flat@1080p 2 · quintic-flat@4k 1 · curve3-flat@1080p 2 · curve3-flat@4k 0
- ✅ no white blobs: ≤ 1 % pixels clipped · auto@1080p 0 · auto@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0
