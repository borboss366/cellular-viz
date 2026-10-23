# QA — cellular-viz

QA pipeline for the experiments. No headless browser runs on the phone, so the
pipeline is **qa/harness.html**: it runs in Chrome on the phone, loads an
experiment with a list of parameter variants, records each canvas to a .webm,
measures it, and scores it.

Live: https://borboss366.github.io/cellular-viz/qa/harness.html

## How a sweep works

1. Open the harness, pick an experiment, paste variant lines
   (`label :: query string`, add `::tap` when the page needs a Play tap).
2. ▶ Run sweep. Each variant: load → warm-up → record ~12 s → metrics.
3. Videos land in Downloads as `exp_label.webm`. Tap **Copy report** and paste
   it in the group chat; share the videos there too. QA commits both into the
   folder of that experiment and updates its index.

## Auto score (0–10)

Weighted: motion in a visible band (30%), coverage 15–60% (25%), pulse =
motion variance over time, rewards beat response (15%), colourfulness (15%),
fps ≥ 30 (15%). The score ranks variants; the human verdict (keep / maybe /
dull) decides.

## Folders

Each experiment gets a folder with an `index.md` (variant table: params, video,
auto score, verdict) and a `videos/` directory.

- [04-lenia-metronome](04-lenia-metronome/index.md)
- [05-flow-lenia](05-flow-lenia/index.md)
- [06-effects](06-effects/index.md) — the 5 researcher effects, once built

## Effects under test (researcher's list)

To sweep the 5 effects they must be switchable from the URL. Proposed contract
for dev (one page, 06, or flags on 04):

| effect | params |
|---|---|
| 1 bloom | `fxBloom=0..1` (strength), `fxBloomBeat=0/1` (pump on kick) |
| 2 emboss + sheen | `fxEmboss=0..1`, `fxSheen=0..1` |
| 3 cosine palettes | `fxPal=0..n` (palette id), `fxPalDrift=0/1` |
| 4 warp trails | `fxZoom=1.00..1.03`, `fxDecay=0.90..0.995` |
| 5 kick bulge | `fxBulge=0..1` |

With that, a sweep is just variant lines like
`bloom-low :: preset=four&fxBloom=0.3 ::tap`.

## Headless on the box (QA box)

`qa/run.mjs` drives the same harness in headless Chromium (Playwright) on the
home server, presses Play in each variant, and writes
`qa/<exp>/runs/<YYYY-MM-DD-HHMM>/`:

- `results.json` — metrics, scores and run info (box, GPU, Chromium, renderer)
- `report.md` — the harness table plus a header
- `stills/NN-label.png` — one frame per variant, mid-recording
- `console.log` — browser console, page errors, harness steps
- `videos/` — .webm per variant; **git-ignored**, stays on the box

```
cd qa && npm install && npx playwright install chromium
node run.mjs --exp 06-lenia-effects.html                  # harness defaults
node run.mjs --exp 04-lenia-metronome.html --variants v.txt --warm 4 --dur 12
```

The box runs in a container without root or a GPU: missing Chromium libs are
unpacked from Debian .debs into `~/qa-libs` (with a `fonts.conf`) and
`run.mjs` picks them up. WebGL runs on SwiftShader, so **fps from the box is
software speed (~16 fps) and says nothing about the phone**; the fps part of
the score is near 0 for every variant there. Compare variants with each other.

### Watch and grade (QA viewer)

`node qa/serve.mjs --port 8787` on the box, then open `http://192.168.8.164:8787/`
on the home Wi-Fi. Every run lists its videos with scores; keep / maybe / dull
and a note are saved to `verdicts.json` and written into `results.json` and
`report.md`. Only those reports go to GitHub; videos stay on the box.
LAN only, no login: don't expose the port to the internet.
