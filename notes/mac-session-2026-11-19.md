# Mac session 3 (19 Nov): set changes, offset calibration, new scenes in OBS and Resolume

The user's steps for tonight (pasted at the start). Background: docs/GUEST_DJ_RUNBOOK.md,
notes/mac-session-2026-11-18.md. Main at the start: e670915 (Merge #267).
- Changes since 18 Nov:
  - #262: Open all scenes places the windows on a diagonal at 960 x 540 content;
  - #263: the scenes follow the conductor's offset; range up to +500 ms;
  - #267: 24 Paint Pour (finger pour, ?beatFx=0, ?pulse).
- The new set: 16 Hodge, 06 Lenia, 24 Paint Pour (beatFx=0), 11 Riemann (scene=ribbon). Mass Gap is out. set.json is
  not changed yet (still 16 / 12 / 06), so the two new scenes are opened by hand.

## State at the start (about 00:30)
- The tunnel is open (ssh on [::1] and 127.0.0.1 :8790).
- Chrome has run with --disable-backgrounding-occluded-windows since 18 Nov 22:58, with one window (Gmail).
- LCXL3 and the BenQ projector (1920 x 1080) are connected.
- OBS and Resolume are not running.
- Audio inputs: BlackHole 2ch and the MacBook Pro Microphone only. No USB interface.

## Results
| Step | Result |
|---|---|
| 1 Tunnel and Chrome | PASS. The tunnel was already open, and Chrome already had the flag (no restart). The conductor and set.html were opened fresh in a new window (= a hard reload). The box serves #262 (set.js uses screen.availWidth; set.json window 960 x 540, bar 63); set.json's scenes are still 16 / 12 / 06 |
| 2 Open all scenes, diagonal, crop | Diagonal PASS. The box updated set.json during the session to the 4-scene set (16, 06, 24 beatFx=0, 11 scene=ribbon); after a reload Open all scenes opened 4 windows. Chrome bounds (pt): Hodge {0,38,960,640}, Lenia {256,172,1216,774}, Paint Pour {512,306,1472,908}, Riemann {768,440,1728,1042}: 960 x 602 each, step 256 across and 134 down. Crop check: see step 4 |
| 3 Offset calibration, profile "home" | not done (waited for the EQ calibration scene; "home" was not saved, it was made on 20 Nov at +140) |
| 4 OBS: CV-24, CV-11, CV-12 removed | PASS after 3 fixes. The scene "Scene" = CV-16 (Hodge, window 12709), CV-06 (Lenia, 12710), CV-24 (Paint Pour, 12711), CV-11 (Riemann, 12712). Window ids were matched to the windows' positions with CGWindowList. Each has Crop/Pad top 126 above its DistroAV NDI Output. show_cursor false on all four (saved). dns-sd: CV-16, CV-06, CV-24, CV-11 (+ CV-TEST from BrowserTest). CV-12 is gone |
| 5 Resolume layers and faders | PASS after fixes. The faders reach Resolume (IAC: BF 05 210, BF 06 231, BF 07 231, BF 08 464 messages). The mappings, read from Shortcuts/MIDI/Default.xml: layer n = fader n, for n = 1-4 (fixed once, see Problems). The projector then showed all four once the column-6 clips were started. Saved 23:56 as Compositions/Example.avc: 4 layers, NDI clips CV-16, CV-24, CV-06 and CV-11 (no CV-12) |
| 6 Paint Pour finger, no beat stir | not done |
| 7 USB interface, mac-check, line clock | not possible: no USB interface connected (inputs: BlackHole, built-in mic) |
| 8 Delay re-measure at the new offset | not done |

## Problems and fixes
- OBS step 4, three slips, each found from OBS's saved scene file (basic/scenes/Untitled.json) and dns-sd:
  - (a) The old Mass Gap source was reused for Riemann and renamed CV-11, but its NDI filter was still named CV-12, so
    it sent "CV-12". Fix: NDI name / filter name CV-11 + Apply changes.
  - (b) CV-24 first had no filters, then sent "CV-24 (CV-24)" until Apply changes was clicked.
  - (c) "Show cursor" was not saved as off until the properties were closed with OK.
- **The mouse pointer shows on the projector over a scene, although the pages set cursor:none under capture=1.**
  OBS's macOS Screen Capture draws the system pointer itself when "Show cursor" is on. Fix: Show cursor off in every
  source (done). For the runbook: add "untick Show cursor" to the OBS source steps.

- **Resolume fader mapping slipped:** after adding layer 4, layer 1 had moved to fader 4 and layer 4 sat on fader 5,
  so fader 1 did nothing. Found from the MIDI preset: the RawInputMessage key steps by 256 per CC; fader 1 = CC 5 =
  key ...644031. Fix: re-learn layer 1 -> fader 1 and layer 4 -> fader 4 in Edit MIDI.
- **Only Lenia on the projector, the others black:** no column-6 clip was playing (no clip had the playing frame, and the
  Composition Monitor was black), and layer 2's opacity was at 0 %. The OBS log was clean and all four NDI senders were
  up. Fix: click the "Column 6" header to start the clips, and raise the faders. For the runbook: after opening the
  composition, start the NDI column.
- **The NDI picture is 1920 x 1078, not 1080** (Resolume: "NDI 1920x1078 30p"). The windows from #262 are 960 x 602 pt
  (539 pt content + 63 pt bar), so Crop/Pad top 126 leaves 1078 px. 2 px off; Resolume scales it. For the box agents:
  check whether Chrome makes the content 539 instead of 540 (set.js windowFeatures height=540), or whether the bar is
  62 pt here.
- **The NDI streams are 30p** (Resolume clip info), as noted on 18 Nov (OBS at 30 fps).
- The user asked Puggie for a calibration scene with an equaliser (for setting the offset by eye).

## Summary for the Orchestrator
- Diagonal Open all scenes PASS; OBS has CV-16/06/24/11 (Crop 126, Show cursor off), CV-12 removed.
- Resolume: 4 NDI layers on faders 1-4, saved as Example.avc. Runbook: start the NDI column; untick Show cursor.
- NDI is 1920 x 1078 at 30p (2 px short; a box check of set.js height vs the 62/63 pt bar).
- Not done: offset calibration (waits for the EQ scene), Paint Pour finger test, delay re-measure. No USB interface.
