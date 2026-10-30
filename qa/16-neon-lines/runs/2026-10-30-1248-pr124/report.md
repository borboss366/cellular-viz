# 16-neon-lines · #124 @45a4258

16c 27 Neon Lines (#37 comment 6444942841, 16c): Clebsch cubic ray-cubic film, 27 lasers, 10 Eckardt diamonds, A5 glides (5-cycle on the drop), build-up 3/7/15/27 on 32-bar sections (walls at bars 8, 16, 24 = the drop). Truths 1-6 also run under node (qa/runner/test/clebsch16c.test.mjs). 120 BPM; startBar puts each window on its event.

30/30 gates pass · warm-up 4 s · 12 s per run

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | clip | clip.mean | lum.mean | lum.min | lum.max | errors | gpuBusy | value.truths | value.t1 | value.t1maxF | value.t2 | value.t3 | value.t4 | value.t5 | value.glideMaxF | value.t6 | value.buildCounts | value.generalPosition | value.liveMaxRelF | value.pairsBad | value.pairsChecked | value.lineCountOk | value.counts | value.walls | value.wallCrossings | value.wallBandMaxBeats | value.wallCrossMaxMs | value.firstWall | value.glides | value.drops | value.lines | value.eckardt | value.diamondsOnScreen | value.peaks | value.laserEnergy | value.forceDrop |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| drop@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 28.7 | 23.2 | 36.8 | 0 | 0 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 6.84819e-15 | 0 | 1756 | true | "27" | 0 | 0 | 99 | 999 | "none" | 29 | 1 | 27 | 10 | 10 | 1 | 0.0289148 | "function" |
| drop@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 28.51 | 23.08 | 35.81 | 0 | 1 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 2.23591e-14 | 0 | 1657 | true | "27" | 0 | 0 | 99 | 999 | "none" | 28 | 1 | 27 | 10 | 8 | 1 | 0.0387416 | "function" |
| build@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 21.14 | 16.26 | 31.76 | 0 | 3 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 2.08724e-12 | 0 | 1737 | true | "3,7,15" | 2 | 2 | 0.1334 | 10.1542 | "8:1up" | 28 | 0 | 15 | 2 | 2 | 2 | 0.0211715 | "function" |
| build@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 21.23 | 16.21 | 31.53 | 0 | 0 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 2.37089e-12 | 0 | 1660 | true | "3,7,15" | 2 | 2 | 0.1332 | 10.1542 | "8:1up" | 28 | 0 | 15 | 2 | 2 | 2 | 0.0155884 | "function" |
| climb@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 26.9 | 20.13 | 41.56 | 0 | 2 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 1.25851e-12 | 0 | 1742 | true | "7,15,27" | 2 | 2 | 0.1334 | 20.3129 | "16:2up" | 29 | 1 | 27 | 10 | 9 | 2 | 0.0315347 | "function" |
| climb@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 26.92 | 20.38 | 41.78 | 0 | 1 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 1.25851e-12 | 0 | 1665 | true | "7,15,27" | 2 | 2 | 0.1334 | 10.1542 | "16:2up" | 28 | 1 | 27 | 10 | 8 | 2 | 0.0287079 | "function" |
| drop-auto@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 22.97 | 14.36 | 36.29 | 0 | 3 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 9.26944e-13 | 0 | 1738 | true | "3,7,15,27" | 4 | 4 | 0.1334 | 10.2449 | "24:3up" | 28 | 1 | 3 | 0 | 0 | 4 | 0.00229179 | "function" |
| drop-auto@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 22.69 | 14.52 | 36.2 | 0 | 0 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 6.15411e-13 | 0 | 1650 | true | "3,7,15,27" | 4 | 4 | 0.1666 | 19.7234 | "24:3up" | 29 | 1 | 3 | 0 | 0 | 4 | 0.00185756 | "function" |
| collapse@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 18.96 | 14.85 | 26.55 | 0 | 2 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 1.01119e-12 | 0 | 1733 | true | "3,7,15,27" | 4 | 4 | 0.1334 | 20.3129 | "31:3down" | 28 | 0 | 7 | 0 | 0 | 4 | 0.00813363 | "function" |
| collapse@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 18.89 | 14.86 | 26.19 | 0 | 0 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 1.01119e-12 | 0 | 1645 | true | "3,7,15,27" | 4 | 4 | 0.1336 | 37.7279 | "31:3down" | 28 | 0 | 7 | 0 | 0 | 4 | 0.00752504 | "function" |
| all-finite@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 24.25 | 22.01 | 27.74 | 0 | 2 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 3.55009e-16 | 0 | 1751 | true | "27" | 0 | 0 | 99 | 999 | "none" | 0 | 0 | 27 | 10 | 10 | 0 | 0.0320756 | "function" |
| all-finite@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 24.19 | 21.73 | 27.59 | 0 | 0 | true | true | 1.7053e-10 | true | true | true | true | 7.53633e-16 | true | "3,7,15,27" | 0.0835509 | 3.55009e-16 | 0 | 1663 | true | "27" | 0 | 0 | 99 | 999 | "none" | 0 | 0 | 27 | 10 | 10 | 0 | 0.0329342 | "function" |

- ✅ QA 1: the 27 table lines lie on F (max |F| < 1e-9, float64) · drop@1080p true · drop@4k true
- ✅ QA 2: 135 meeting pairs (126 affine + 9 at infinity), each line meets 10 · drop@1080p true · drop@4k true
- ✅ QA 3: 10 Eckardt points (7 finite + 3 directions) · drop@1080p true · drop@4k true
- ✅ QA 4: M maps the P4 model onto F = 0; e_i - e_j go to the Eckardt points · drop@1080p true · drop@4k true
- ✅ QA 5: S5 permutes lines and diamonds, orbits {15,12} and {10}; A5 glides keep |F_s| < 1e-9 · drop@1080p true · drop@4k true
- ✅ QA 6: build-up 3/7/15/27 lines, 3/9/45/135 meetings, 10 Eckardt at the end · drop@1080p true · drop@4k true
- ✅ every drawn laser lies on the drawn surface (relative |F|, every frame) · drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0
- ✅ meetings match the line count on every frame away from the walls · drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0
- ✅ real line count = r + C(r,2) + c + r on every frame · drop@1080p true · drop@4k true · build@1080p true · build@4k true · climb@1080p true · climb@4k true · drop-auto@1080p true · drop-auto@4k true · collapse@1080p true · collapse@4k true · all-finite@1080p true · all-finite@4k true
- ✅ 27 lines all the way · drop@1080p "27" · drop@4k "27" · all-finite@1080p "27" · all-finite@4k "27"
- ✅ bar 8: pair 1 born, 3 -> 7 (first wall after startBar 4) · build@1080p "8:1up" · build@4k "8:1up"
- ✅ bar 16: pair 2 born, 7 -> 15 (first wall after startBar 12) · climb@1080p "16:2up" · climb@4k "16:2up"
- ✅ bar 24, the drop: pair 3 born, 15 -> 27 (first wall after startBar 20) · drop-auto@1080p "24:3up" · drop-auto@4k "24:3up"
- ✅ bar 31: 27 -> 15 -> 7 -> 3 · collapse@1080p "3,7,15,27" · collapse@4k "3,7,15,27"
- ✅ a wall crossed (gold flash) · build@1080p 2 · build@4k 2 · climb@1080p 2 · climb@4k 2 · drop-auto@1080p 4 · drop-auto@4k 4
- ✅ three walls crossed back · collapse@1080p 4 · collapse@4k 4
- ✅ a wall crossing logged (__qa.wallCrossings: |u| below 0.1 and back) · build@1080p 2 · build@4k 2 · climb@1080p 2 · climb@4k 2 · drop-auto@1080p 4 · drop-auto@4k 4
- ✅ every wall crossing leaves the |u| < 0.1 band within 1 beat · build@1080p 0.133 · build@4k 0.133 · climb@1080p 0.133 · climb@4k 0.133 · drop-auto@1080p 0.133 · drop-auto@4k 0.167
- ✅ every wall crossing passes u = 0 within 40 ms of its wall beat (a frame that skips the band counts) · build@1080p 10.154 · build@4k 10.154 · climb@1080p 20.313 · climb@4k 10.154 · drop-auto@1080p 10.245 · drop-auto@4k 19.723
- ✅ the drop fired (5-cycle glide) · drop@1080p 1 · drop@4k 1 · drop-auto@1080p 1 · drop-auto@4k 1
- ✅ shape rate 1/2 bar: a glide every 2 beats · drop@1080p 29 · drop@4k 28
- ✅ glides=0 stands still · all-finite@1080p 0 · all-finite@4k 0
- ✅ 10 diamonds · drop@1080p 10 · drop@4k 10 · all-finite@1080p 10 · all-finite@4k 10
- ✅ chart allFinite: all 10 diamonds in view · all-finite@1080p 10 · all-finite@4k 10
- ✅ #88 forceDrop hook · drop@1080p "function" · drop@4k "function" · build@1080p "function" · build@4k "function" · climb@1080p "function" · climb@4k "function" · drop-auto@1080p "function" · drop-auto@4k "function" · collapse@1080p "function" · collapse@4k "function" · all-finite@1080p "function" · all-finite@4k "function"
- ✅ fps.p05 ≥ 55 · drop@1080p 59.52 · drop@4k 59.88 · build@1080p 59.88 · build@4k 59.52 · climb@1080p 59.52 · climb@4k 59.88 · drop-auto@1080p 59.88 · drop-auto@4k 59.52 · collapse@1080p 59.88 · collapse@4k 59.52 · all-finite@1080p 59.88 · all-finite@4k 59.88
- ✅ longFrames ≤ 0.5 · drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0
- ✅ errors ≤ 0 · drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0
- ✅ gpuBusy ≤ 10 · drop@1080p 0 · drop@4k 1 · build@1080p 3 · build@4k 0 · climb@1080p 2 · climb@4k 1 · drop-auto@1080p 3 · drop-auto@4k 0 · collapse@1080p 2 · collapse@4k 0 · all-finite@1080p 2 · all-finite@4k 0
- ✅ no white blobs: <= 1 % pixels clipped · drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · climb@1080p 0 · climb@4k 0 · drop-auto@1080p 0 · drop-auto@4k 0 · collapse@1080p 0 · collapse@4k 0 · all-finite@1080p 0 · all-finite@4k 0
