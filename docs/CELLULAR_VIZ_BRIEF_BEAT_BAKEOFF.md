# cellular-viz — brief: other beat trackers, compared on recordings

Owner, 23 Nov. Follows the first session with the guest DJ (22 Nov):
the tracker did poorly on the microphone, the hand carried the night.

## Question

Is there a live beat tracker that is clearly better than ours on the
music she plays? Answer it on recordings, offline, before anything is
added to the live chain. `experiments/clock-tracker.js` stays closed;
nothing here changes it.

## Why now

- She mixes by hand, so rekordbox's built-in Link is out.
- The rekordbox helper (rkbx_link) may or may not run on her laptop.
- The user has a DJ controller at home for now and can make his own
  recordings.
- Her music includes Flume-style tracks: syncopated, half-time, far
  from four-on-the-floor. The corpus has little of that.

## Inputs (private folder on the box, never the repo)

1. The 22 Nov session: the audio as recorded (microphone) and the
   conductor log with the user's taps and holds, if they were saved.
2. One or two mixes the user records himself: 20 to 30 minutes each,
   mixed by hand, recorded from the software's master output (no
   microphone). One of house from the corpus, one of her kind of
   tracks.
3. Later: the rehearsal, recorded through the cable.

The usual rule holds: no names of people, tracks or files in the
repo, the logs or the reports. Rows are `mix-1`, `mix-2`.

## Reference

- Beat This! run offline over each recording, as in the corpus.
- If the user gets the rekordbox helper running on his Mac while he
  records, its log of the decks' beats is a second reference. Report
  where the two disagree by more than 35 ms, and for how long. On
  syncopated tracks the reference itself may be wrong; say so, do not
  hide it.

## Candidates

- Ours, as frozen, alone.
- Ours with the user's hand (input 1 only, from the log).
- BeatNet in its online mode.
- madmom in its online mode.
- One more if the box's research turns up a tracker built for live
  use that installs cleanly. No more than one.

A candidate that does not install and run within an hour is dropped,
with one line saying why. Do not patch a candidate.

## What to measure, per recording and candidate

1. **Accuracy:** share of played time with the nearest reported beat
   inside ±35 ms of the reference. Also the share at half a beat off
   (the wrong side) and at double or half tempo.
2. **Delay:** how long after a beat the candidate reports it (median
   and p90), using only audio up to that moment. A tracker that is
   right 200 ms late needs a predictor in front of it; note that.
3. **Transitions:** seconds to recover after each mix point the
   reference shows.
4. **Cost:** CPU on the box, and an estimate for the Mac (M3 Pro).

One table per recording, one summary table. Report only. No tuning of
any candidate to these recordings, and no constants per track.

## Reading the result

- **A candidate beats ours by 15 points or more of time inside the
  gate, on the user's mixes and on the session:** it earns a second
  brief: a beat service on the Mac where every source steers the same
  flywheel (ours, the new one, the helper, the hand on top).
- **Less than that:** stop. The plan stays the wired input, the hand,
  and a beat from the decks when one is available.
- Either way the recordings and the references are kept as corpus
  rows; they are the first real-DJ rows we have.

## Out of scope

Any change to the tracker or to `clock.js`; a live service; the
helper's bridge (its own brief once her laptop and version are
known); Pro DJ Link.
