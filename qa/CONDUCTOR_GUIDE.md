# Conductor page: how to use it

The page is `experiments/clock-conductor.html` (#188). The box serves it at :8790. The setup steps are in
`qa/runner/README.md`, section "Conductor page (:8790)". On the page, push "Help" or `?` for a short form of this guide.

## Before the sitting (on the box)
1. Start the server:
   `podman exec -d --env-file ~/.config/cellular-viz-runner.env pi-durable-worker sh -c 'sh "$RUNNER_HOME/qa/runner/conductor.sh"'`
2. On the laptop, open Chrome. Do not use Safari.
3. Go to http://192.168.8.164:8790/
4. To use the mixer or mic as input: run `ssh -L 8790:localhost:8790 puggie@192.168.8.164` first. Then open
   http://localhost:8790/?clock=line
5. To hear the clock: add `?click=1` to the address (or `&click=1` after `?clock=line`). The page then plays a click
   on each clock beat.

## The parts of the page
- Header: the input ("line:page" or "line"), the track badge ("no track", "scored" or "UNSCORED (no grid)"), the
  session, the log state, "Start audio", "Download log", "Help".
- Clock (left): "output" tempo, "tracker alone (shadow)" tempo, the state, the confidence bar, the lamps (beat, kick,
  bar 1), the orange dots, the 8 band bars, the fix buttons, "last fix".
- Playlist (right): the track list, "Load to NEXT", "Play / pause", "Crossfade N", the fade time, the two decks.
- Marks (right, under the decks): the mark name list, "Mark M", "[ −1" and "] +1".
- Calibrate (left, lower): the white flash bar, the offset slider, the venue profiles.
- Session (right, lower): the record count and the last log lines.

## The decks
The page has two decks. A deck holds one track.
- "–" (empty): the deck has no track.
- NEXT (blue): the deck has a track. The track does not play.
- LIVE (red): the deck plays its track. The clock listens to this deck.

A track in the Playlist does not play.
After the first load, the empty deck can show LIVE. This is normal. When you push "Play / pause", the loaded deck
changes to LIVE.

## Play a track
1. In the Playlist box, click a track name.
2. Click "Load to NEXT".
3. Wait until the deck shows the track name. The deck shows "loading ..." while the track loads.
4. Push "Play / pause" or Space. The deck changes to LIVE.

"Play / pause" also starts the audio. You do not have to push "Start audio".
Push "Play / pause" or Space again to pause the LIVE deck.

## Go to the next track
1. In the Playlist box, click the next track name.
2. Click "Load to NEXT".
3. Wait until the deck shows the track name.
4. Push "Crossfade N" or N. The NEXT deck changes to LIVE. The old deck stops after the fade time.

The fade time is the "fade" box (8 s at the start). If the LIVE deck does not play, the NEXT deck starts at once,
with no fade.

## Read the clock
- output: the clock tempo, with your fixes.
- tracker alone (shadow): the same tracker, with no fixes.
- beat lamp: flashes on each clock beat.
- kick lamp: flashes on each kick that the tracker hears.
- bar 1 lamp: shows the "1" from the reference grid. It works only when the LIVE deck plays a track with a grid.
- Orange dots: the last 16 kicks. The middle line is "on the beat".
  - Dots on the middle line: the clock is correct.
  - Dots right of the line: the kick comes after the clock beat. The clock is early.
  - Dots left of the line: the kick comes before the clock beat. The clock is late.
  - Dots at the two edges: the clock is half a beat off.

## Fix the clock
- Dots at the edges (off-beat): push "flip" (Shift+F).
- Tempo is half the correct tempo: push "×2" (Shift+D).
- Tempo is double the correct tempo: push "÷2" (Shift+H).
- Small offset: push "−10" or "+10" (Shift+, or Shift+.).
- Wrong "1": push "set 1" (Shift+1) on the downbeat.
- Wrong tempo: push "tap" (Shift+A) on each beat, for 4 beats or more.
- To start again: push "reset" (Shift+0).

The page records each fix. "last fix" shows the last one.

## Confirm the bar
1. Play a track that has a grid. The track badge shows "scored".
2. Wait until the bar 1 lamp comes on.
3. Push Shift+S on the "1".

Shift+S counts only while the bar 1 lamp is on.

## Set a mark
1. In the Marks list, select the mark name (for example bar1, kickIn, transition1). The list fills when a track loads.
2. Push "Mark M" or M at that moment in the music.
3. To move bar1 by one beat, push "[ −1" or "] +1" (the keys [ and ]). Set bar1 with M first.

Marks go on the LIVE deck only, while it plays. A track with no grid cannot have marks.

## Calibrate (optional)
1. Look at the white flash bar. It flashes on each clock beat.
2. Move the offset slider (or push Alt+, and Alt+.) until the flash and the sound of the kick come together.
3. To keep the offset for a venue: type a name, then push "Save".

## After the sitting
1. Push "Download log" to keep a copy of the session.
2. Stop the server. Run the start command with "stop" after conductor.sh, without -d:
   `podman exec --env-file ~/.config/cellular-viz-runner.env pi-durable-worker sh -c 'sh "$RUNNER_HOME/qa/runner/conductor.sh" stop'`
3. Tell Orchestrator. VIZ dev then applies the marks.

## If there is a problem
- The Playlist box is empty: the server cannot find the tracks folder. Check the CONDUCTOR_TRACKS line in
  `~/.config/cellular-viz-runner.env`. Then stop and start the server again.
- A deck shows "loading ..." for more than 20 seconds: the track did not load. Select a different track.
- "load a track first": no deck has a track. Do "Play a track" again.
- "load the next track first": the NEXT deck has no track. Do steps 1 to 3 of "Go to the next track".
- You cannot see "Start audio": the header is too long. Push "Play / pause". It starts the audio too.
- Do not push K (answer-key lamp) in a scored run.
