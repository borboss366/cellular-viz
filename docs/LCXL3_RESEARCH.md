# Launch Control XL 3: research for the controller (#188)

A consolidated write-up of VIZ research's findings in #188
([6765710646](https://github.com/borboss366/cellular-viz/issues/188#issuecomment-6765710646),
[6765748314](https://github.com/borboss366/cellular-viz/issues/188#issuecomment-6765748314)), for the controller brief
[docs/CELLULAR_VIZ_BRIEF_NOVATION.md](CELLULAR_VIZ_BRIEF_NOVATION.md). Docs only: no code lands during the freeze.

> **Read this with the brief.** Two points in it have changed:
> - **D1:** the research changed it. The controller uses **DAW mode**, not a Custom Mode built in Components (section 1).
> - **D4:** the user has **not approved** it. Only the restart command landed (#211: `fix('restart')`, Shift+R).
>   There is no tap-clears-hold and no second-press release.
>
> The brief is kept as the reviewer wrote it.

## Sources

The official source is Novation's **Launch Control XL 3 programmer's reference guide** (7 articles). The help-centre HTML
pages answer 403 to scripts, but the Zendesk API serves the same articles as JSON:

- Section (all 7 articles): https://userguides.novationmusic.com/api/v2/help_center/en-gb/sections/27840433446546/articles.json
- Articles (HTML, for a browser):
  [About the guide](https://userguides.novationmusic.com/hc/en-gb/articles/27840466285586-About-the-Launch-Control-XL-3-programmer-s-reference-guide),
  [Bootloader](https://userguides.novationmusic.com/hc/en-gb/articles/27840433544850-Entering-Launch-Control-XL-3-s-bootloader),
  [MIDI on Launch Control XL 3](https://userguides.novationmusic.com/hc/en-gb/articles/27840433609362-MIDI-on-Launch-Control-XL-3),
  [SysEx message format](https://userguides.novationmusic.com/hc/en-gb/articles/27840466455314-SysEx-message-format-used-by-Launch-Control-XL-3),
  [Standalone (MIDI) mode](https://userguides.novationmusic.com/hc/en-gb/articles/27840433730450-Launch-Control-XL-3-programmer-s-standalone-MIDI-mode),
  [DAW mode](https://userguides.novationmusic.com/hc/en-gb/articles/27840466544402-Launch-Control-XL-3-programmer-s-DAW-mode),
  [Feature controls](https://userguides.novationmusic.com/hc/en-gb/articles/27840466607890-Launch-Control-XL-3-feature-Controls)
- The four table images (DAW-mode CC map and colour palette), linked, not copied:
  [CC map, decimal](https://userguides.novationmusic.com/hc/article_attachments/27840434038546),
  [CC map, hex](https://userguides.novationmusic.com/hc/article_attachments/27840445891986),
  [palette](https://userguides.novationmusic.com/hc/article_attachments/27840434222994),
  [palette](https://userguides.novationmusic.com/hc/article_attachments/27840451242002)

The guide's text and images are Novation's; this repo links to them and quotes only the message bytes it needs.

## 1. DAW mode, not a Custom Mode

**Chosen: DAW mode.** In DAW mode "all buttons, and surface elements not belonging to performance features … can be
accessed and will report on the DAW In/Out (USB) interface only", with a fixed, documented CC map. LED colour is a
plain CC on the same indices, the screen takes text and bitmaps from the host, and the feature controls (LED and screen
brightness, display timeout) are available.

A Custom Mode would mean a layout hand-built in Novation Components, no documented host control of the screen, and a
mapping that lives outside the repo. The brief's D1 assumed a Custom Mode; this research replaces that with DAW mode.

The one cost: DAW mode is on the **DAW port only**. The page picks the port whose name contains `DAW`, enables DAW
mode on connect and disables it on unload.

- Enable: `9Fh 0Ch 7Fh` or `F0h 00h 20h 29h 02h 15h 02h 7Fh F7h`
- Disable: `9Fh 0Ch 00h` or `F0h 00h 20h 29h 02h 15h 02h 00h F7h`
- Not to be confused with `9Fh 0Bh 7Fh`, which is the **feature controls** enable.

## 2. The CC map (official text)

| Control | CC | Channel |
|---|---|---|
| Faders 1–8 | 05h–0Ch (5–12) | 16 |
| Encoders, 3 rows of 8 | 0Dh–24h (13–36): rows 13–20, 21–28, 29–36 | 16 |
| Buttons | in the CC map images only (see section 9) | 1 |
| Shift | (its feature control) | 7 |

- The touch example confirms fader 1 = `BEh 05h`.
- **Relative encoders:** each encoder row can switch to relative mode with `B6h 45h / 48h / 49h <7Fh | 00h>`, pivot
  40h. In relative mode the row's CCs are **+40h**: 4Dh–54h, 55h–5Ch, 5Dh–64h. By default encoders are absolute and
  pick up position values the host sends them.

## 3. LEDs

- **Palette:** `B0h <control index> <colour index>`, on the control's own CC index. The palette indices are only in the
  palette images.
- **Exact RGB:** `F0h 00h 20h 29h 02h 15h 01h 53h <control index> <R> <G> <B> F7h`. This needs no palette, so the page
  can set any colour directly; the palette is only needed for the one-byte form.
- Flash or pulse is not mentioned anywhere in the article text.

## 4. The display

- **Configure:** `F0h 00h 20h 29h 02h 15h 04h <target> <config> F7h`
- **Text:** `F0h 00h 20h 29h 02h 15h 06h <target> <field> <text…> F7h`
- **Targets:** 05h–24h, one per analog control; **35h** stationary; **36h** overlay.
- **`<config>`:**
  - bits 0–4, the arrangement: 1 = name + text value, 2 = title + name + value, 3 = title + 8 encoder names,
    4 = name + numeric value;
  - bit 5 auto-shows the display on touch; bit 6 auto-shows it on change;
  - **00h** cancels; **7Fh** brings up the display with its current contents.
- **Text characters:** ASCII 20h–7Eh, plus 1Bh empty box, 1Ch filled box, 1Dh flat, 1Eh heart.
- **Bitmap:** `F0h 00h 20h 29h 02h 15h 09h <target> <1216 bytes> F7h`, 19 bytes × 64 rows for the 128×64 screen, 7 pixels
  per byte, highest bit leftmost. The guide prints the terminator as `7Fh`, most likely a typo for F7h. An ack message
  follows that is "suitable for timing fluid animations". The device holds one bitmap in memory at a time.
- **To check on hardware:** the guide gives **20h** (stationary) and **21h** (global temporary) as the bitmap targets,
  while the text targets are **35h/36h**.

## 5. Feature controls (channel 7, query on channel 8)

| CC | Feature |
|---|---|
| 111 | LED brightness |
| 112 | screen brightness |
| 113 | temporary-display timeout (1/10 s) |
| 30 | surface mode select: 01h DAW Mixer, 02h DAW Control, 06h–09h Custom Modes 1–4, 12h–1Dh Custom Modes 5–16 |
| 63 | Shift (on/off) |
| 69 / 72 / 73 | encoder rows 1 / 2 / 3: relative output on/off |
| 70 | fader pickup |
| 71 | touch events |

The bootloader (hold Page Up + Page Down at power-up) can set a **device ID 1–8**, which is appended to the port name.
That keeps a second controller distinguishable.

## 6. Web MIDI on Chrome / macOS

- **Permission:** since Chrome 124 the whole Web MIDI API is behind a permission prompt
  ([Chrome blog](https://developer.chrome.com/blog/web-midi-permission-prompt)).
  - Ask once with `requestMIDIAccess({ sysex: true })`, and pre-check with
    `navigator.permissions.query({ name: 'midi', sysex: true })`
    ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMIDIAccess)).
  - Without SysEx the browser masks incoming SysEx and throws on sending it
    ([Web MIDI spec, MIDIOptions](https://webaudio.github.io/web-midi-api/)). That means no LEDs, no screen and no
    DAW-mode enable.
- **Secure context:** `requestMIDIAccess` needs a secure context. `https`, `localhost` and `127.0.0.0/8` qualify, but
  port and domain don't count, so `http://192.168.8.164:8790` is not one
  ([Secure Contexts §3.1](https://w3c.github.io/webappsec-secure-contexts/)). The same applies to the clock's
  AudioWorklet (#208).
- **Port by name:** pick the input and output whose `name` contains `DAW`, then remember the `id`. The spec says ids are
  only best-effort stable across a replug.
- **Hot-plug:** `MIDIAccess.onstatechange` fires on connect and disconnect, and the spec advises against relying heavily
  on it. So re-resolve the port by name on every statechange, and re-send the DAW-mode enable plus the LED and screen
  state after a replug: the device powers up in standalone mode.
- **Sharing with Resolume:** on macOS, CoreMIDI shares a device between applications
  ([CoreMIDI multi-client](https://salivity.github.io/midi/article/how-mac-os-core-midi-enables-multi-app-midi-sharing)).
  But two hosts driving the same LEDs, screen and mode will fight. Resolume must not be mapped to this controller's DAW
  port; it may use the MIDI port.

## 7. D5: serving without the ssh tunnel

**Recommended (VIZ research):** HTTPS from the box with a local CA ([mkcert](https://github.com/FiloSottile/mkcert)).

- **Why:** the audio stays on the box (R9), there is one URL at a party, and both AudioWorklet and Web MIDI get the
  secure context they need.
- **Setup (one-off):**
  1. On the Mac: `brew install mkcert` and `mkcert -install`.
  2. Still on the Mac: `mkcert 192.168.8.164 box.local`.
  3. Copy the two PEM files to the box and point `conduct-serve` at them.
  4. Keep `rootCA-key.pem` on the Mac only.
- **Fallback, already working:** the ssh tunnel (`ssh -L 8790:localhost:8790 puggie@192.168.8.164`, then
  http://localhost:8790/), because localhost is a secure context.
- **Possible one-evening alternative:** the Chrome flag `--unsafely-treat-insecure-origin-as-secure`. It is allowed by
  [Secure Contexts §7.2](https://w3c.github.io/webappsec-secure-contexts/), but it isn't a standing setup.
- **Not recommended for the gate run:** serving from the laptop, because the corpus would exist twice, or the audio would
  stream over plain LAN HTTP.

## 8. The probe page (spec, to build after the freeze)

`experiments/lcxl3-probe.html` is small and standalone: no clock and no page pause. It fills the two gaps the guide
leaves as images, and proves the plumbing.

1. **Connect:** `requestMIDIAccess({ sysex: true })`.
   - Show a banner and stop if `sysexEnabled` is false.
   - Pick the in and out ports whose name contains `DAW`, with a dropdown override.
   - Re-resolve on `onstatechange`, then repeat step 2.
2. **Enter DAW mode:** send `9Fh 0Ch 7Fh` and log it. A checkbox offers the SysEx form instead. Set LED brightness to
   mid (`B6h 6Fh 40h`) so colours read true.
3. **Log every inbound message:** time, port, status, channel (1-based), data1, data2, and a decode (fader / encoder row
   / button / feature), with a "copy table" button.
4. **Learn pass:** a prompt walks the user through the buttons left to right, top row then bottom, then each pot row.
   Each press records `{ label, channel, cc }`. Each row has a Redo button.
5. **Palette sweep:** for the chosen button, step `B0h <idx> <n>` through n = 0…127 at about 4 per second, with n on
   screen. The user marks the green, amber, red and off indices, and notes any n that flashes or pulses.
6. **RGB test:** `F0 00 20 29 02 15 01 53 <idx> 7F 10 40 F7` on one button, to prove the no-palette path.
7. **Screen test:**
   - configure the stationary display: `F0 00 20 29 02 15 04 35 01 F7`;
   - send the text "CONDUCTOR" / "READY" with `06 35 00` and `06 35 01`;
   - trigger it with `04 35 7F`;
   - try a bitmap to target 20h once, to settle the 20h/21h vs 35h/36h question.
8. **Exit:** on `beforeunload` and on a Stop button:
   - send `9Fh 0Ch 00h`;
   - clear the LEDs;
   - cancel the stationary display (`04 35 00`).

   Never leave the device in DAW mode.
9. **Output:**
   - a Download button writes `lcxl3.map.json`:
     `{ device, portNameHint: 'DAW', channels: { pots: 16, buttons: 1, feature: 7 }, faders, encoders, buttons,
     palette: { green, amber, red, off, flashing }, display: { textTargets: [53, 54], bitmapTarget }, notes }`;
   - the raw log is saved as JSONL.

## 9. Open items

- **Button CCs and palette indices** are only in the PNG tables above; the article text doesn't give them. The probe
  page's learn pass and palette sweep read them off the hardware. That is the first hardware check and fills
  `lcxl3.map.json`.
- **Bitmap target:** 20h/21h vs 35h/36h, settled by probe step 7.
- **Flash / pulse** in the palette: unknown until the sweep.

## 10. The user's decisions so far

- **D4 (tap clears the hold, second ÷2/×2 press releases it) is not approved.** Only the restart command landed:
  `fix('restart')`, Shift+R on the keys, #211. The brief's D4 section stays as the reviewer wrote it, for reference.
- **D5:** not decided yet. The research recommends mkcert HTTPS; the tunnel works today.
- The tracker stays frozen. Controller code comes after the freeze, starting with the probe page.
