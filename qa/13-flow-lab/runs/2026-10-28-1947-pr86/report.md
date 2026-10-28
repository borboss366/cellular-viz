# 13-flow-lab · #86 @bf67c4d

#86 panic key: panic.js loads in a page without errors, B-blackout and calm toggle through window.__panic, and the page still runs at speed underneath.

8/8 gates pass · warm-up 4 s · 8 s per run

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | errors | gpuBusy | value.loaded | value.blackout | value.back | value.calm | value.cleared | value.overlay |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kh@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | "off" | "blackout" | "off" | "calm" | "off" | true |

- ✅ panic.js loaded, starts off · kh@1080p "off"
- ✅ B: blackout on · kh@1080p "blackout"
- ✅ B again: back to the scene · kh@1080p "off"
- ✅ `: calm fallback · kh@1080p "calm"
- ✅ clear() · kh@1080p "off"
- ✅ overlay element in the page · kh@1080p true
- ✅ errors ≤ 0 · kh@1080p 0
- ✅ fps.p05 ≥ 55 · kh@1080p 59.88
