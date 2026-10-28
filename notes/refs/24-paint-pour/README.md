# 24 Paint Pour: reference frames

The user's three phone screenshots of Tame Impala's "The Less I Know The Better" video (dir. CANADA), the look source for 24 Paint Pour (#87). They're rotated 90° on purpose: the user held the phone sideways, so the frames are portrait with black bars and the vevo bug on the left. Crop to the picture area (about y 155–1255 of 1568) before sampling colours.

| file | what it shows | spec points it backs (#87) |
|---|---|---|
| `frame1-marbled-crimson-cyan-pink.jpg` | flat marbled moment: crimson, cyan and hot-pink fields, thin lemon/lime veins along the cyan–red boundaries, a drop with concentric rings (top right) and an orange/yellow corner | veins (`veinColour` lime/yellow), rings inside drops, cyan not cobalt, shallow DoF on the left |
| `frame2-glossy-yellow-cyan-red-on-black.jpg` | thick glossy 3-D paint on black: a red blob inside a lemon field with a cyan rim, bevelled rounded edges, small strong highlights | height field + bevel, Blinn-Phong gloss with small highlights, lots of black (`blackShare`) |
| `frame3-yellow-blob-with-string.jpg` | a single lemon blob mid-pour with thin paint strings, red and cyan out of focus behind it, mostly black | paint strings during the slow pour, depth of field |

Use them as visual targets only: the palette hexes in #87 are eyeballed from these frames, not pixel-sampled yet.

Source: the user's screenshots, posted for the bots on 2026-10-28.
