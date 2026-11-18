# Saturday brief: a guest DJ plays, the user plays the visuals (Sat 21 Nov, 17:00)

Reviewer, 18 Nov. For Puggie and the box agents, and for Claude Code
on the Mac. Until Sunday this brief comes before
`docs/CELLULAR_VIZ_BRIEF_OWNER.md`. Your role's standing rules still
apply (`docs/AGENT_PUGGIE.md`, `docs/AGENT_CC_MAC.md`).

## The goal

On Saturday a DJ plays house at the user's place on a Pioneer
DDJ-FLX4. The user plays the visuals on the projector with the
controller. It is the first time anyone but the user sees the project.

It went well if:
- the picture runs for the whole visit without a freeze or a crash;
- the beat on the projector is right most of the time, and the user
  can fix it by hand in a few seconds when it is not;
- the user has the DJ's reactions per scene, in the DJ's words;
- the audio, the conductor log and a video are on the box afterwards.

Nothing else is a goal this week. If a task does not serve the list
above, it waits until Sunday.

## What is different from the 16 Nov setup

The music no longer comes from the conductor page. It comes from the
DJ's controller. So:
- Audio in: FLX4 master (one RCA pair) -> two RCA Y-splitters -> the
  speakers, and -> a USB audio interface with line input on the Mac
  (the user buys these). Fallback: the Mac's built-in microphone.
- The conductor page is the user's beat monitor and hand controls, on
  the line-in clock, with no playlist. Scenes follow it on the shared
  clock as before, and take their sound from the same input.
- The FLX4 has no Pro DJ Link. The beat comes from the tracker, hold
  and the user's hand. Expect the off-beat slide on house
  (`qa/CLOCK_CORPUS.md`, known limitation): flip, then hold.

## Timeline

| When | What | Who |
|---|---|---|
| Wed 18 | Mac session 2 (`docs/MAC_SESSION_2_BRIEF.md`): 20 min run, hold, panic, delay. Then tag the working commit `saturday-rc1`. | user + CC |
| Thu 19 | Audition with the controller: pick 5 to 7 scenes, tune, write `set.json`. Test the audio chain with any device playing into the splitters. Box: the tasks below, merged by 23:59. | user + CC; box |
| Fri 20 | Dress rehearsal: one hour of house from another device into the line input, cold start from the runbook only, recording on. Fix only what is on the fix list. Tag `saturday`. | user + CC; box on call |
| Sat 21 | Setup finished by 16:00. The visit from 17:00. Notes the same evening. | user + CC |
| Sun 22 | Box scores the log and replays the audio. The owner's brief resumes. | box |

## Freeze

- From the `saturday-rc1` tag: main takes only the box tasks below and
  fixes from the user's fix list. One PR per fix, with its test.
- From Thursday 23:59: fix list only.
- On Saturday the box serves the `saturday` tag, not main. The
  Orchestrator checks the served commit at 15:00 and tells the user
  the hash.
- Closed all week: `clock-tracker.js`, how any scene looks (the user
  tunes that himself), new scenes, the scene kit, the refactor, corpus
  tooling, anything for the Bolt or the lidar.

## Box tasks (all by Thursday 23:59, each small)

1. **Guest mode on the conductor.** The page must work as a monitor
   with no playlist: line-in clock from a chosen input
   (`?clock=line&in=<label>`), publishing the shared clock, all hand
   fixes and hold, the log. If it already does, prove it with a test
   and one line in the guide. If not, fix that and nothing more.
2. **Scenes on the same input.** `set.html` and `set.json` take the
   input label once (a field or a query parameter) and pass it to every
   scene, so the user does not edit three URLs.
3. **Recording, exact alignment (only if it lands by the deadline).**
   The conductor records its own input next to the log, one file per
   session, on the same clock as the log lines. Start and stop with the
   log. If it is not merged and tested by Thursday 23:59, drop it; the
   user records with QuickTime and the box aligns by onsets on Sunday.
4. **Mac check.** Add: a line input other than BlackHole is present;
   its name. Fix the false "controller not found" (match "LCXL3").
5. **Where the files go.** One folder on the box for Saturday's audio,
   log and video, outside the repo. Put the copy commands in the
   runbook.
6. **Runbook.** A "guest DJ" page: the audio chain above, guest mode,
   the order of steps for Saturday, the fallback to the microphone,
   and what to do if a scene freezes (bring its window forward, re-pick
   it in OBS), if the beat is off (flip, hold), if all else fails
   (panic, then Resolume's own content).

On call Friday evening and Saturday 15:00 to 17:00 for the fix list.
After 17:00 on Saturday nothing is deployed.

## Claude Code on the Mac

- Wed: session 2 as its brief says. At the end, tell the user the
  commit to tag.
- Thu: help the user audition and tune. Record his words per scene.
  Then the audio chain: the interface shows as an input, the conductor
  in guest mode locks to music played into the splitters, the scenes
  move.
- Fri: the dress rehearsal from a cold start, following only the
  runbook. Time the setup. Write every step that was wrong or missing.
  Watch the frame rate with recording on (OBS Stats, Resolume's fps).
  Keep a fix list: at most what blocks Saturday.
- Sat: bring the route up with the user by 16:00, run the checks, then
  step back. During the visit do nothing unless the user asks.
- Each day: one notes file, `notes/mac-session-<date>.md`.

## Recording on Saturday (ask the DJ first)

1. **Audio and the log (must have).** The line input, lossless, for
   the whole visit: the conductor's own recording if box task 3 landed,
   else QuickTime audio. Plus the conductor log.
2. **A phone on a tripod (must have)** filming the projector and the
   room. It is the only record of what was seen, with the real delay.
3. **One OBS recording (only if Friday shows no frame drops):** the
   audio input plus a scene with the three captures and the conductor
   window.
All three go to the box's folder (box task 5). None go in the repo.
The DJ's name, track names and the audio never go in the repo.

## What the user asks the DJ

- May we record the audio and film the projector?
- rekordbox or Serato?
- Ten minutes of honest reaction per scene: keep, change, drop, why.

## After Saturday

Sunday: the box scores the log, replays the audio through the tracker
with and without the user's fixes, and writes one short report: time
inside the gate, hand presses, every freeze, the delay. The DJ's
recording becomes the corpus's DJ-set row (private). Then the owner's
brief resumes, with the user's and the DJ's notes deciding the seven.
