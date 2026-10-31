# 24 Paint Pour: reference frames

The user's three phone screenshots of Tame Impala's "The Less I Know The Better" video (dir. CANADA), the look source for 24 Paint Pour (#87). The video picture is rotated 90° inside portrait screenshots, with black letterbox bars and the vevo bug on the left. The picture area is rows 311–1257 of 1568 in frames 1 and 3, and rows 317–1181 in frame 2.

| file | what it shows | spec points it backs (#87) |
|---|---|---|
| `frame1-marbled-crimson-cyan-pink.jpg` | flat marbled moment: crimson, cyan and hot-pink fields, thin lemon/lime veins along the cyan–red boundaries, a drop with concentric rings (top right) and an orange/yellow corner | veins (`veinColour` lime/yellow), rings inside drops, cyan not cobalt, shallow DoF on the left |
| `frame2-glossy-yellow-cyan-red-on-black.jpg` | thick glossy 3-D paint on black: a red blob inside a lemon field with a cyan rim, bevelled rounded edges, small strong highlights | height field + bevel, Blinn-Phong gloss with small highlights, lots of black (`blackShare`) |
| `frame3-yellow-blob-with-string.jpg` | a single lemon blob mid-pour with thin paint strings, red and cyan out of focus behind it, mostly black | paint strings during the slow pour, depth of field |

## Sampled colours

QA box sampled these frames on 2026-10-28 (per-field sRGB medians, cropped to the picture; frame 3's blurred red, cyan and lime left out). The `canada` palette in #87 comes from them; see #87 comment 6479691254.

| field | sampled median | `canada` palette |
|---|---|---|
| black ground | #030207 | `#030207` |
| crimson | #AE0711 | `#B8121C` (lifted to 3:1 against the ground) |
| cyan | #5AD6E7 | `#5AD6E7` |
| lemon | #E0CC34 | `#E0CC34` |
| hot pink | #DF4798 (frame 1 only) | `#DF4798` |
| orange | #A4541D (frame 1: #A95723) | `#A95723`, rings and cells only |
| lime veins | #CEE370 | `#CEE370` |
| mustard (frame 1) | #D3A01B | `#D3A01B`, the yellow vein option |

- Black plus dark shaded paint covers 4%, 57% and 71% of frames 1–3.
- Near-white (L ≥ 0.9) covers 0.25%, 0% and 0%.
- Frame 1's 13% pale pink `#E0B8D0` is read as lit, defocused pink, not a paint colour.

The sampler is on the QA box only: `qa/history/2026-10-28-2158-sample-refs-24.{mjs,sh}`.

Source: the user's screenshots, posted for the bots on 2026-10-28.
