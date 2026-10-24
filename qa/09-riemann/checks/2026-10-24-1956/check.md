# 09 Riemann check · 2026-10-24-1956

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- viewport 1920×1080, canvas 1920×1080
- overview window: x -36.6…34.6, y -2.0…38.0

## Winding of hue at the known points (want +1 zero, −1 pole)

| point | winding | raw |
|---|---|---|
| zero ½+14.134725i | ✅ 1 | 1/1/1/1 |
| zero ½+21.02204i | ✅ 1 | 1/1/1/1 |
| zero ½+25.010858i | ✅ 1 | 1/1/1/1 |
| zero ½+30.424876i | ✅ 1 | 1/1/1/1 |
| zero ½+32.935062i | ✅ 1 | 1/1/1/1 |
| trivial zero -2 | ✅ 1 | 1/1/1/1 |
| trivial zero -4 | ✅ 1 | 1/1/1/1 |
| trivial zero -6 | ✅ 1 | 1/1/1/1 |
| trivial zero -8 | ✅ 1 | 1/1/1/1 |
| trivial zero -10 | ✅ 1 | 1/1/1/1 |
| pole s=1 | ✅ -1 | -1/-1/-1/-1 |

## Scan of −3 ≤ Re s ≤ 4 (and the real axis to −12): every pinwheel found

| at | winding | cells | is |
|---|---|---|---|
| -10.25 + 0.00i | 1 | 2 | trivial -10 |
| -8.25 + 0.00i | 1 | 2 | trivial -8 |
| -6.25 + 0.00i | 1 | 2 | trivial -6 |
| 0.75 + 0.00i | -1 | 2 | pole s=1 |
| -4.00 + 0.25i | 1 | 2 | trivial -4 |
| -2.00 + 0.25i | 1 | 2 | trivial -2 |
| 0.50 + 14.25i | 1 | 2 | zero 14.134725 |
| 0.50 + 21.25i | 1 | 2 | zero 21.02204 |
| 0.25 + 25.00i | 1 | 2 | zero 25.010858 |
| 0.50 + 30.25i | 1 | 2 | zero 30.424876 |
| 0.50 + 32.75i | 1 | 2 | zero 32.935062 |

## Speed at 1920×1080, playing, 10 s

| view | fps | frame p50 | p99 | worst |
|---|---|---|---|---|
| travel | 60 | 16.7 ms | 16.8 ms | 16.8 ms |
| overview | 60 | 16.7 ms | 16.8 ms | 16.8 ms |

## Result

- ✅ zerosOnLine
- ✅ trivialAndPole
- ✅ noStray
- ✅ fps60
- ✅ noErrors

Errors: none
