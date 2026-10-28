# Canyon beat sync, calibrated (qa/check-pulse.mjs)

Calibration page qa/data/flash.html: the measuring pipeline adds a steady ~26 ms (p10–p90 24–30 ms);
measured on itself after correction it reads onset 5 ms / peak 10 ms (expected 0–17 ms: first frame after the beat).
Page clock fitted against real time (residual 10–15 ms from the audio clock).

| build | onset (half-max rise) after beat | peak after beat | mean motion |
|---|---|---|---|
| canyon pulses @fd01d0f (PR #41) | ~65 ms | 72 ms | 0.061 |
| canyon bumps @e05ec3f (PR #42) | ~95 ms | 113 ms | 0.080 |

Target (VIZ QA): ≤ 40 ms after correction. Both are late. Audio output latency not included.

GPU (check-canyon41.mjs, 1920×1080): both 60 fps with vsync, 0 frames > 20 ms. Uncapped headroom:
pulses 146 fps (median 7.1 ms) → bumps 69 fps (median 14.2 ms, p99 32.5 ms, 109 frames > 20 ms).
