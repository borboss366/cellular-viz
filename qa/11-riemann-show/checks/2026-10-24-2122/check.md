# 11 Riemann show check · 2026-10-24-2122

Truth: LMFDB zeros (qa/data/lmfdb-zeta-zeros-1-40.txt) and a sieve here; the page's numbers are compared, not trusted.

| check | result | detail |
|---|---|---|
| zeros below 120 | ✅ | 38/38, worst error 4.8e-7, 0 extra |
| ribbon: |ζ| minima at the zeros | ✅ | 38 minima, missing 0, extra 0, largest |ζ| at a minimum 0.0358 |
| scope: Z crossings at the zeros | ✅ | 38 crossings, worst 1.6e-4, missing 0, extra 0 |
| primes: approxPi(x, all 38) vs π(x), x = 2.5…99.5 | ✅ | worst 0.436 (with 10 zeros: 0.61); steps 2…59 (17) |
| beat lock: camera on a zero at each downbeat | ✅ | 22 downbeat samples, worst 0.026, median 0.017 |
| page keeps animating (camera time moves) | ❌ | ribbon yes · march yes · scope yes · primes **FROZEN** · canyon yes · map yes · auto **FROZEN** |
| fps at 1920×1080 per scene | ✅ | ribbon 60 (worst 16.8 ms) · march 60 (worst 16.8 ms) · scope 60 (worst 16.8 ms) · primes 60 (worst 16.8 ms) · canyon 60 (worst 16.8 ms) · map 60 (worst 16.8 ms) · auto 60 (worst 16.8 ms) |
| page errors | ❌ | Cannot read properties of null (reading 'length'); SCENE_FN[name] is not a function |
