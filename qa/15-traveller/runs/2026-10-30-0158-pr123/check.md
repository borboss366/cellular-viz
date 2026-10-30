# 15-traveller · experiment for #123 @ce1f5ff

| gate | result | detail |
|---|---|---|
| QA 3: the tour is a Hamiltonian cycle | ✅ | settled@1080p true · settled@4k true · build@1080p true · build@4k true · ants@1080p true · ants@4k true · small-verify@1080p true · small-verify@4k true · big@1080p true · big@4k true · hot@1080p true · hot@4k true |
| QA 1: with heat 0 no move raises the length | ✅ | settled@1080p 0 · settled@4k 0 · build@1080p 0 · build@4k 0 · ants@1080p 0 · ants@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 · hot@1080p 0 · hot@4k 0 |
| QA 2: a settled 2-opt tour has no crossings | ✅ | settled@1080p 0 · settled@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 |
| QA 2b: after a snap the tour is crossing-free within 4 bars | ✅ | settled@1080p true · settled@4k true · big@1080p true · big@4k true |
| heat 0: no uphill moves | ✅ | settled@1080p 0 · settled@4k 0 · ants@1080p 0 · ants@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 |
| heat 1: uphill moves accepted (knob metric > 0) | ✅ | hot@1080p 0.022 · hot@4k 0.022 |
| QA 4: (n-1)!/2 = 181440 at 10, 60822550204416000 at 20 | ✅ | settled@1080p true · settled@4k true · build@1080p true · build@4k true · ants@1080p true · ants@4k true · small-verify@1080p true · small-verify@4k true · big@1080p true · big@4k true · hot@1080p true · hot@4k true |
| QA 5: an edge no ant used decays by exactly (1-rho) | ✅ | ants@1080p 0 · ants@4k 0 |
| QA 5: ant iterations ran (one per beat) | ✅ | ants@1080p 58 · ants@4k 58 |
| QA 6: Held-Karp = brute force (n 5-9, in the page) | ✅ | settled@1080p true · settled@4k true · build@1080p true · build@4k true · ants@1080p true · ants@4k true · small-verify@1080p true · small-verify@4k true · big@1080p true · big@4k true · hot@1080p true · hot@4k true |
| cities macro 0 = 8 (Held-Karp range) | ✅ | small-verify@1080p 8 · small-verify@4k 8 |
| fps.p05 ≥ 55 | ✅ | settled@1080p 59.88 · settled@4k 59.88 · build@1080p 59.52 · build@4k 59.52 · ants@1080p 59.52 · ants@4k 59.88 · small-verify@1080p 59.88 · small-verify@4k 59.88 · big@1080p 59.88 · big@4k 59.52 · hot@1080p 59.88 · hot@4k 59.88 |
| longFrames ≤ 0.5 | ✅ | settled@1080p 0 · settled@4k 0 · build@1080p 0 · build@4k 0 · ants@1080p 0 · ants@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 · hot@1080p 0 · hot@4k 0 |
| errors ≤ 0 | ✅ | settled@1080p 0 · settled@4k 0 · build@1080p 0 · build@4k 0 · ants@1080p 0 · ants@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 · hot@1080p 0 · hot@4k 0 |
| gpuBusy ≤ 10 | ✅ | settled@1080p 0 · settled@4k 0 · build@1080p 3 · build@4k 0 · ants@1080p 2 · ants@4k 0 · small-verify@1080p 4 · small-verify@4k 0 · big@1080p 3 · big@4k 0 · hot@1080p 3 · hot@4k 0 |
| no white blobs: <= 1 % pixels clipped | ❌ | fails on big@1080p, big@4k · settled@1080p 0.392 · settled@4k 0.513 · build@1080p 0.379 · build@4k 0.516 · ants@1080p 0.383 · ants@4k 0.499 · small-verify@1080p 0.157 · small-verify@4k 0.212 · big@1080p 1.009 · big@4k 1.278 · hot@1080p 0.385 · hot@4k 0.499 |
| PR | ℹ️ | #123 @ce1f5ff |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |
| GPU busy before the run | ℹ️ | 1, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
