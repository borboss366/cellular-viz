# Beat relay: the delay report

Task 6 of `docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md`: the relay's delay, p50 and p99, on
one machine and on the box through the tunnel. The steps are in ASD-STE100.

## What it measures

Two sockets on one relay, on one clock. One socket sends a probe 20 times a second.
The other socket receives it and records "now minus send time". This is the path from
the conductor to a scene: sender, relay, receiver. The two sockets are on the same
machine, so no clock offset is in the number.

The clock messages carry their own time, so this delay does not move the beat. It is
the delay of panic, slot steps, knobs and (later) the levels.

The page also sends 20 `time-ask` pings. It shows the round trip to the relay and the
relay's clock offset against the page's machine. Through the tunnel, this is the box's
clock against the Mac's clock (report only).

Tools:
- `qa/relay-delay.mjs`: the measurement in node (`--self`, `--url`) and a separate test
  relay (`--serve`, for section 3 only). The test relay is not conduct-serve.
- `experiments/relay-delay.html`: the same measurement in Chrome. conduct-serve serves it
  at `/experiments/relay-delay.html` (section 2). The test relay serves it at `/`
  (section 3).

## 1. One machine (the box)

The box gives this number with every test run. `qa/runner/test/relay-delay.test.mjs`
measures 300 probes on an in-process relay and prints one line:
`# relay delay one machine: ...`. Copy the p50 and p99 into the table below.

To measure again by hand, inside the runner container:

1. Go to the runner clone (`$RUNNER_HOME`).
2. Run `node qa/relay-delay.mjs --self --n 600 --rate 20`.
3. Read the line that starts with `relay delay`.

## 2. Through the tunnel (the Mac and the box)

This measures conduct-serve's own relay on the box, through the normal tunnel. Use it in
the Mac session, after conduct-serve has the relay (the restart that Orchestrator asks the
user for). The page and the relay come from conduct-serve, so nothing else starts on the box.

### Before you start

1. Make sure that conduct-serve on the box has the relay. Ask Orchestrator if you do not
   know.
2. Do not start a test relay on the box. This section uses conduct-serve only.

### On the Mac: measure

1. Open Terminal.
2. Type this command and push Return:
   `ssh -L 8790:localhost:8790 puggie@192.168.8.164`
   If the tunnel of the runbook (section 2 of `docs/GUEST_DJ_RUNBOOK.md`) is open, use it.
   Do not open a second tunnel.
3. Keep this Terminal window open.
4. Open Chrome.
5. Go to `http://localhost:8790/api/relay`.
6. Make sure that the page shows numbers (for example `"clients"`). If the page shows an
   error or "not found", stop. conduct-serve does not have the relay. Tell Orchestrator.
7. Go to `http://localhost:8790/experiments/relay-delay.html`.
8. Make sure that the page shows "Relay delay".
9. Push **Start**.
10. Keep this tab in front. Do not use Chrome during the test. The test takes approximately
    35 seconds.
11. Wait until the status shows "done".
12. Read the table. Write down p50 and p99 of "sender to receiver".
13. Push **Download**. Chrome saves a JSON file.
14. Give the JSON file to Orchestrator. The file has numbers only. It has no names.
15. Optional: set the rate to 60. Push **Start** again. Push **Download** again.

The probes go through the same relay as the conductor and the scenes. The pages do not
use the probes. You can do the test while the conductor and the scenes are open. Do not do
it during the set.

If the status shows "the socket failed": make sure that the tunnel is open and that step 6
shows numbers. Then do step 9 again.

## 3. One machine (the Mac, optional)

Only if the Mac has node. Then you can measure without the box:

1. Open Terminal. Go to the clone of cellular-viz.
2. Run `node qa/relay-delay.mjs --serve --port 8791`.
3. In Chrome, go to `http://localhost:8791/`. Do steps 9 to 14 of section 2.
4. In Terminal, push Control-C. This stops the test relay.

## Results

Report only. The brief's gate (Browser Sources against window capture) is measured in the
Mac session, not here.

| Where | Rate | p50 ms | p99 ms | max ms | lost | Date |
|---|---|---|---|---|---|---|
| one machine (box, node) | 20/s | | | | | |
| Mac to box to Mac (tunnel, Chrome) | 20/s | | | | | |
| Mac to box to Mac (tunnel, Chrome) | 60/s | | | | | |
| one machine (Mac, Chrome, optional) | 20/s | | | | | |
