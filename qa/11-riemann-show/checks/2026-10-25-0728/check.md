# 11 Riemann show check · 2026-10-25-0728

Truth: LMFDB zeros (qa/data/lmfdb-zeta-zeros-1-40.txt) and a sieve here; the page's numbers are compared, not trusted.

| check | result | detail |
|---|---|---|
| zeros below 120 | ✅ | 38/38, worst error 4.8e-7, 0 extra |
| ribbon: |ζ| minima at the zeros | ✅ | 38 minima, missing 0, extra 0, largest |ζ| at a minimum 0.0358 |
| scope: Z crossings at the zeros | ✅ | 38 crossings, worst 1.6e-4, missing 0, extra 0 |
| primes: approxPi(x, all 38) vs π(x), x = 2.5…99.5 | ✅ | worst 0.436 (with 10 zeros: 0.61); steps 2…59 (17) |
| beat lock: camera on a zero at each downbeat | ✅ | 8 downbeats seen frame by frame: worst 1.4e-14 (tCam on the first frame after the downbeat, wound back by u·gap, vs LMFDB γ); every one of 961 frames vs the LMFDB warped clock: worst 1.4e-14; raw nearest frame 0.052 (one frame of camera travel); old ±0.015-bar window: worst 0.103 |
| no blank frames (screenshots, HUD hidden) | ✅ | ribbon 0/8 blank (lit ≥ 0.07, sd ≥ 15.4) · march 0/8 blank (lit ≥ 0.13, sd ≥ 25.5) · scope 0/8 blank (lit ≥ 0.08, sd ≥ 17.2) · primes 0/8 blank (lit ≥ 0.07, sd ≥ 16.2) · canyon 0/8 blank (lit ≥ 0.56, sd ≥ 52.7) · map 0/8 blank (lit ≥ 0.68, sd ≥ 51) · auto (1-bar sections) 0/24 blank (lit ≥ 0.07, sd ≥ 15.9) |
| auto switches through every scene | ✅ | order seen with bars=1: ribbon → march → scope → primes → canyon → map → ribbon → march → scope |
| page keeps animating (camera time moves) | ✅ | ribbon yes · march yes · scope yes · primes yes · canyon yes · map yes · auto yes |
| fps at 1920×1080 per scene | ✅ | ribbon 60 (worst 16.8 ms) · march 60 (worst 16.8 ms) · scope 60 (worst 16.8 ms) · primes 60 (worst 16.8 ms) · canyon 60 (worst 16.8 ms) · map 60 (worst 16.8 ms) · auto 60 (worst 16.8 ms) |
| page errors (thrown + caught in __qa.errors) | ✅ | thrown: none; caught: ribbon 0 · march 0 · scope 0 · primes 0 · canyon 0 · map 0 · auto 0 |
