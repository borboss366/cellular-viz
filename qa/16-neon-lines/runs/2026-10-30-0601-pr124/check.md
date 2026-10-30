# 16-neon-lines · experiment for #124 @71acc57

| gate | result | detail |
|---|---|---|
| QA 1: the 27 table lines lie on F (max  F  < 1e-9, float64) | ✅ | drop@1080p true · drop@4k true |
| QA 2: 135 meeting pairs (126 affine + 9 at infinity), each line meets 10 | ✅ | drop@1080p true · drop@4k true |
| QA 3: 10 Eckardt points (7 finite + 3 directions) | ✅ | drop@1080p true · drop@4k true |
| QA 4: M maps the P4 model onto F = 0; e_i - e_j go to the Eckardt points | ✅ | drop@1080p true · drop@4k true |
| QA 5: S5 permutes lines and diamonds, orbits {15,12} and {10}; A5 glides keep  F_s  < 1e-9 | ✅ | drop@1080p true · drop@4k true |
| QA 6: build-up 3/7/15/27 lines, 3/9/45/135 meetings, 10 Eckardt at the end | ✅ | drop@1080p true · drop@4k true |
| every drawn laser lies on the drawn surface (relative  F , every frame) | ✅ | drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0 |
| meetings match the line count on every frame away from the walls | ✅ | drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0 |
| real line count = r + C(r,2) + c + r on every frame | ✅ | drop@1080p true · drop@4k true · build@1080p true · build@4k true · climb@1080p true · climb@4k true · drop-auto@1080p true · drop-auto@4k true · collapse@1080p true · collapse@4k true · all-finite@1080p true · all-finite@4k true |
| 27 lines all the way | ✅ | drop@1080p "27" · drop@4k "27" · all-finite@1080p "27" · all-finite@4k "27" |
| bar 8: 3 -> 7 | ❌ | fails on build@1080p, build@4k · build@1080p "3,7,15" · build@4k "3,7,15" |
| bar 16: 7 -> 15 | ❌ | fails on climb@1080p, climb@4k · climb@1080p "7,15,27" · climb@4k "7,15,27" |
| bar 24 (the drop): 15 -> 27 | ❌ | fails on drop-auto@1080p, drop-auto@4k · drop-auto@1080p "3,7,15,27" · drop-auto@4k "3,7,15,27" |
| bar 31: 27 -> 15 -> 7 -> 3 | ✅ | collapse@1080p "3,7,15,27" · collapse@4k "3,7,15,27" |
| a wall crossed (gold flash) | ✅ | build@1080p 2 · build@4k 2 · climb@1080p 2 · climb@4k 2 · drop-auto@1080p 4 · drop-auto@4k 4 |
| three walls crossed back | ✅ | collapse@1080p 4 · collapse@4k 4 |
| the drop fired (5-cycle glide) | ✅ | drop@1080p 1 · drop@4k 1 · drop-auto@1080p 1 · drop-auto@4k 1 |
| shape rate 1/2 bar: a glide every 2 beats | ✅ | drop@1080p 29 · drop@4k 29 |
| glides=0 stands still | ✅ | all-finite@1080p 0 · all-finite@4k 0 |
| 10 diamonds | ✅ | drop@1080p 10 · drop@4k 10 · all-finite@1080p 10 · all-finite@4k 10 |
| chart allFinite: all 10 diamonds in view | ✅ | all-finite@1080p 10 · all-finite@4k 10 |
| #88 forceDrop hook | ✅ | drop@1080p "function" · drop@4k "function" · build@1080p "function" · build@4k "function" · climb@1080p "function" · climb@4k "function" · drop-auto@1080p "function" · drop-auto@4k "function" · collapse@1080p "function" · collapse@4k "function" · all-finite@1080p "function" · all |
| fps.p05 ≥ 55 | ✅ | drop@1080p 59.88 · drop@4k 59.88 · build@1080p 59.88 · build@4k 59.52 · climb@1080p 59.88 · climb@4k 59.88 · drop-auto@1080p 59.52 · drop-auto@4k 59.88 · collapse@1080p 59.52 · collapse@4k 59.88 · all-finite@1080p 59.88 · all-finite@4k 59.52 |
| longFrames ≤ 0.5 | ✅ | drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0 |
| errors ≤ 0 | ✅ | drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0 |
| gpuBusy ≤ 10 | ✅ | drop@1080p 0 · drop@4k 1 · build@1080p 3 · build@4k 0 · climb@1080p 2 · climb@4k 1 · drop-auto@1080p 3 · drop-auto@4k 0 · collapse@1080p 2 · collapse@4k 0 · all-finite@1080p 2 · all-finite@4k 1 |
| no white blobs: <= 1 % pixels clipped | ✅ | drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0 |
| PR | ℹ️ | #124 @71acc57 |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
