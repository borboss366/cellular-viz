# 16-hodge-kaleidoscope · experiment for #84 @2fcb554

| gate | result | detail |
|---|---|---|
| QA 1: numbers equal the spec's table (all presets, curve g = 0–6) | ✅ | auto@1080p true · auto@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat@4k true |
| QA 2: h^{p,q} = h^{q,p} and h^{p,q} = h^{n−p,n−q} | ✅ | auto@1080p true · auto@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat@4k true |
| QA 3: row sums = Betti numbers | ✅ | auto@1080p true · auto@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat@4k true |
| QA 4: rendered row glow (linear, L_k = 1) ∝ Betti within 1 % | ✅ | auto@1080p 0 · auto@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0 |
| QA 5: Euler characteristic 2−2g / 24 / −200 / +200 | ✅ | auto@1080p true · auto@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat@4k true |
| fps.p05 ≥ 55 | ✅ | auto@1080p 59.88 · auto@4k 59.52 · k3-flat@1080p 59.52 · k3-flat@4k 59.88 · quintic-flat@1080p 59.88 · quintic-flat@4k 59.52 · curve3-flat@1080p 59.52 · curve3-flat@4k 59.88 |
| longFrames ≤ 0.5 | ✅ | auto@1080p 0 · auto@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0 |
| errors ≤ 0 | ✅ | auto@1080p 0 · auto@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0 |
| gpuBusy ≤ 10 | ✅ | auto@1080p 0 · auto@4k 1 · k3-flat@1080p 2 · k3-flat@4k 0 · quintic-flat@1080p 2 · quintic-flat@4k 1 · curve3-flat@1080p 2 · curve3-flat@4k 0 |
| no white blobs: ≤ 1 % pixels clipped | ✅ | auto@1080p 0 · auto@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0 |
| PR | ℹ️ | #84 @2fcb554 |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
