# 12 field: the velocity isn't carried between steps (exp-12-mass-gap @abd40a6)

Wide splat (radius 300 cells ≈ uniform) at the centre, κ = 0, φ_red(centre) every frame (4 steps):

| m | expected (Klein–Gordon, uniform) | measured |
|---|---|---|
| 0 | φ grows linearly (v constant) | φ constant 0.025 → 0.022 |
| 0.35 | sin(0.35 t): zero crossing every 9 units | decays e^(−0.06 t), one sign change, then grows the other way |
| 0.6 | sin(0.6 t): crossing every 5.2 units | decays e^(−0.18 t), then grows to −6.6e4 (fp16 overflow) |

Decay rate = dt·m² (0.06, 0.18) and the m = 0 plateau are what you get when v is reset to 0 each step:
c ← c + dt²(∇²c − m²c) — a damped diffusion, with a checkerboard mode whose factor 1 − dt²(8 + m²) is < −1
for m > 0, so it grows and overflows. Likely: the second colour attachment (oVel) isn't stored / isn't renderable,
or the ping-pong FBOs don't have vel on attachment 1.
