# 14-round-point · experiment for #68 @c3b8250

| gate | result | detail |
|---|---|---|
| fps.p05 ≥ 55 | ✅ | auto@1080p 59.52 · auto@4k 59.88 · curve-nokicks@1080p 59.88 · curve-nokicks@4k 59.88 |
| longFrames ≤ 0.5 | ✅ | auto@1080p 0 · auto@4k 0 · curve-nokicks@1080p 0 · curve-nokicks@4k 0 |
| errors ≤ 0 | ✅ | auto@1080p 0 · auto@4k 0 · curve-nokicks@1080p 0 · curve-nokicks@4k 0 |
| gpuBusy ≤ 10 | ✅ | auto@1080p 0 · auto@4k 0 · curve-nokicks@1080p 2 · curve-nokicks@4k 0 |
| thin line (VIZ QA): worst frame ≤ 5 % clipped | ✅ | auto@1080p 3.512 · auto@4k 1.758 · curve-nokicks@1080p 3.512 · curve-nokicks@4k 1.876 |
| thin line (VIZ QA): mean ≤ 3 % clipped | ✅ | auto@1080p 1.902 · auto@4k 1.066 · curve-nokicks@1080p 1.918 · curve-nokicks@4k 1.135 |
| check-14: 1 area falls at 2π per unit τ (±3 %), kicks off; round on the section's last beat | ✅ | dA/dτ ÷ 2π: -0.9999 · A 1.698 → 3.3e-4 · round at bar 16 (section ends 16) |
| check-14: 1b same, kicks on (between kicks) | ✅ | 28 stretches, worst -0.9987 · 28 bumps |
| check-14: 2 L²/4πA never rises between kicks above 1 % of the start area, ends near 1 (kicks off) | ✅ | 1.3369 → 1.0007, largest rise 0 |
| check-14: 2b same, kicks on | ✅ | 1.3458 → 1.0007, largest rise between kicks 0 |
| check-14: 3 no self-crossings, every frame (my O(n²) test) | ✅ | kicks off 0 in 959 frames · kicks on 0 in 958 frames (page counted 0 / 0) · 67–240 vertices |
| check-14: 4 neck pinch on the drop → exactly 2 pieces, then round points | ✅ | 1→2 at bar 14.01 (drop 14, off by 0.01 bar) · after: 2 (still 2 on the section's last frame) · neck 0.0451 → 0.0233, largest rise 0.0003 (reported only) |
| check-14: 5 sync from __qa.events (≤ 40 ms) | ✅ | seed 18 ms (n 2) · kick 8.4 ms (n 72) · hat 8.5 ms (n 144) · snare 8.8 ms (n 36) · pinch 19.1 ms (n 1) |
| check-14: 6 no brightness jump > 25 % frame to frame at a scene change | ✅ | curve→pinch at bar 8.003, pinch→curve at bar 16.004 · worst at a change 13.9 % (7.74→8.99 at bar 0.509) · 0 frames over 25 % · elsewhere (kicks, reported only) worst 31.4 % at bar 9.005 |
| check-14: 60 fps 1080p/1440p/4K | ✅ |  |
| check-14: page alive | ✅ |  |
| check-14: errors | ✅ | none |
| PR | ℹ️ | #68 @c3b8250 |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
