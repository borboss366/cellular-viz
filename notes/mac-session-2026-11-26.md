# Mac session 26 Nov: the line input with the DJ controller

The user ran a session on the line input for the first time: the guest DJ's DDJ-FLX4 (left with the user) played by
rekordbox on the show Mac, its master out into the M-Audio interface, the interface into the Mac.

## Versions
- macOS 14.3, Chrome 158.0.8127.37, Resolume Arena 7.29.0, OBS 33.0.1, rekordbox 7.2.20 (installed today, free plan;
  the DDJ-FLX4 unlocks Performance mode).
- Repo main at ae958e2. The box serves the 7-scene set: experiments/set.json on main has 8 (28 Aurora, #318).

## The chain
rekordbox (Mac) -> DDJ-FLX4 (USB) -> master out (RCA) -> M-Audio inputs 1/2 (line) -> M-Audio (USB) -> the conductor.
The user listens on the DDJ-FLX4's headphones (no speakers).

## Gates
| Step | Result |
|---|---|
| 1 Chrome | PASS: started with `tools/start-chrome.sh` (new today, commit 0b3cf46): --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required |
| 2 mac-check | 10 PASS, 5 WARN, 0 FAIL at the start (no line input, no LCXL3, no projector, Wi-Fi on, Resolume running) |
| 3 DDJ-FLX4 on USB | PASS after a data cable (the first cable gave no USB device). Seen as the audio device "DDJ-FLX4": 2 in, 4 out. Its input was silent (-91 dB) while playing: not usable as the input. Bus-powered from the Mac, through a USB-C adapter (GenesysLogic hub, Chrontel display chip) |
| 4 M-Audio | PASS after moving it from the adapter straight to a Mac port (not enough power on the adapter). Seen as "USB AUDIO  CODEC" (BurrBrown chip), 2 in / 2 out. On the pages: `in=CODEC` |
| 5 Level (ffmpeg volumedetect, 3-4 s) | Peaks -24.5 dB (mean -36.4) at first; -19.4 after the M-Audio gain to ~2 o'clock; **-5.3 dB (mean -22.5)** after the DDJ-FLX4 Master Level up |
| 6 Conductor `?clock=line&in=CODEC` | PASS: locked at 124.2 BPM |
| 7 set.html?in=CODEC, Open slots | PASS: both slots move with the music. Slot windows 960 x 602 |
| 8 Projector | PASS: BenQ PJ 1920 x 1080, extended, Resolume output on it |
| 9 Offset by eye | **+250 ms** on the projector against the DDJ-FLX4 headphones ("home" +180 was the line input of 21 Nov) |

## Problems
- The projector was not seen while it hung on the USB-C adapter (the adapter showed a "Billboard" device, its video
  side not up). Fixed by the user (re-plugged); the projector then came up as BenQ PJ.
- The M-Audio got too little power on the unpowered adapter. Plugged into the Mac directly. The user buys a powered
  USB hub.
- OBS sources "slot A" / "slot B" pointed to old windows (2895 / 2896): re-picked by the user.
- Earlier, a Dock move to the projector screen brought the macOS menu bar ("Arena  Composition ...") over the Resolume
  output. Fix: Resolume Output > Fullscreen > the projector again.

## Decided
- Offset profile for this chain: +250 (headphones on the DDJ-FLX4). Check it again against the room speakers at a gig.

## Files
- On the box, `/home/puggie/pi-durable-worker/data/qa-audio/sessions/`: `conductor-20261126-223503.jsonl`, `.wav`,
  `.wav.json` (sent by the page). No other recording made on the Mac today.

## For the box
- Serve main's set.json on :8790 (28 Aurora as scene 8 is not on the server).
