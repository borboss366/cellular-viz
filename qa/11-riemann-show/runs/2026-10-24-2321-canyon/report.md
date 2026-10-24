# 11 canyon: before vs surface pulses · 2026-10-24-2321

| variant | build | fps (page, check-11) | mean motion | motion peak after beat | pulse strength (peak ÷ median) |
|---|---|---|---|---|---|
| canyon-before | 0b42ff7 | 60 | 0.01777 | 63 ms | 2.89 |
| canyon-pulses | fd01d0f (PR #41) | 60 | 0.06612 | 63 ms | 2.02 |

Motion sampled per captured frame (~26 Hz through captureStream; includes the capture's own 1–2 frame delay), binned over the beat (20 bins of 25 ms at 120 bpm). Tool: qa/check-pulse.mjs.
