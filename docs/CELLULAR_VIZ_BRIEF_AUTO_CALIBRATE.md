# cellular-viz — brief: automatic calibration (the offset and the input level)

Owner, 26 Nov, on the user's question. After the beat sources work;
not before the rehearsal unless it comes free.

## Why

The offset has been set by eye four times and has given four numbers
(+180, +230, +250, +350 ms), each for a different input or way of
listening. By eye it is good to about 50 ms. Every new room, input or
beat source needs it again. The level is set by reading a meter and
turning a knob. Both can be measured by the Mac in under a minute.

## What is possible, and what is not

- **The offset: yes.** The Mac can see the wall with a camera and
  hear the room with its microphone. If the page flashes on the beat
  and the room hears a click on the beat, the gap between "seen" and
  "heard" is the error in the offset.
- **The level: partly.** Software cannot turn the interface's gain
  knob. It can tell the user which way to turn it, and then set one
  trim number for the session.
- **Not this:** levels that keep adjusting themselves while music
  plays. The user declined that on 21 Nov. This is a one-time
  measurement at setup; the number then stays fixed until he
  calibrates again.

## Part 1: the offset

On the calibration page (27), a "Calibrate offset" button.

1. The source plays a click track (a plain metronome file from the
   conductor's deck, or from the DJ software). No music: the tracker's
   own phase habits must not enter the number.
2. The page flashes on the clock's beat, as it does now.
3. A camera that sees the projection reports when each flash appears.
   Use the frame's capture time (`requestVideoFrameCallback`), not the
   time the code ran. The built-in camera faces the wrong way in most
   rooms; a USB webcam on a long cable, or turning the laptop for one
   minute, both do.
4. The built-in microphone reports when each click is heard at the
   desk.
5. Over 30 beats: the median of "seen minus heard" is the correction.
   The page shows it with its spread, and one button applies it and
   saves it to the current profile.

Rules:
- The page refuses to apply a result whose spread is over 20 ms or
  that found fewer than 20 of the 30 flashes, and says which.
- The camera's and the microphone's own delays are constants. Measure
  them once (the same flash and click on the laptop's own screen and
  speaker, camera and mic at arm's length) and store them with the
  profile. State the remaining uncertainty on the page.
- The old way (slider by eye, slow-motion video) stays.
- The result is logged: profile, input, route (Chrome windows or
  Browser Sources), beat source, offset, spread.

## Part 2: one delay per beat source

`beatd` (beat sources brief, task 4) needs a delay constant for each
tracker. With the same click track: each source's reported beat
against the click heard on the line input gives its constant, with
no camera. One button, "Calibrate sources", writes the table and
flags a source whose delay wanders by more than 20 ms.

## Part 3: the input level

On the same page, "Calibrate level", while the loudest part of a
track plays for 20 seconds.

1. **The knob first.** The page reads the peak and tells the user in
   words: turn the interface gain up, down, or leave it. Target: peaks
   between -12 and -6 dBFS, never the CLIP marker.
2. **Then one trim.** With the knob set, the page measures the loud
   level and stores one gain number in the profile, so the same loud
   passage reads the same on the microphone, the line input and the
   next interface. The conductor applies it to the levels it reads
   and publishes; scenes are not changed.
3. The trim is fixed until the next calibration. Nothing adapts
   during the set.

## Checks (the box)

- Node tests on the arithmetic: flash and click times in, correction
  and spread out; refusal on a wide spread or missing flashes; the
  trim from a recorded level.
- A browser test with a fake camera and a fake microphone (a video
  and an audio file with a known gap): the page reports that gap
  within 10 ms.

## The user's gate

In his room: calibrate automatically, then check with the 120 fps
video as on 21 Nov. The two agree within 20 ms, twice in a row, on
the line input and on the microphone. Then the automatic way is the
runbook's way.

## Out of scope

A phone as the camera (it needs HTTPS and a clock offset between
machines); levels that adapt during the set; changing any scene;
the acoustic delay to the far end of a large room.
