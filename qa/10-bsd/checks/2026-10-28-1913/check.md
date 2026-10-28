# 10 BSD check · 2026-10-28-1913

Independent recomputation in Node (BigInt fractions, brute-force counts); the page's own flags are only compared, not trusted.

| check | result | detail |
|---|---|---|
| points exactly on y² = x³+17 | ✅ | 25 distinct points over 150 s, 302 hops, x up to 2439 digits, 0 off the curve |
| page's onCurve flags agree | ✅ | 0 disagreements |
| counts = brute force, first 50 primes | ✅ | 50/50 (primes 5…241) |
| Hasse \|a_p\| ≤ 2√p | ✅ | all 77 primes shown (up to 409) |
| y² = x³ − x over F₇₁ has 72 points | ✅ | page 72, page fn 72, ours 72 |
| integral points of x³+17 in [−2, 5234] | ✅ | page [-2, -1, 2, 4, 8, 43, 52, 5234], ours [-2, -1, 2, 4, 8, 43, 52, 5234] |
| fps at 1920×1080, pmax 5000 | ✅ | 59.8 fps, frame p50 16.7 ms, p99 16.8 ms, worst 50 ms (canvas 1920×1080) |
| page errors | ❌ | Failed to load resource: the server responded with a status of 404 (Not Found); Failed to load resource: the server responded with a status of 404 (Not Found) |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
