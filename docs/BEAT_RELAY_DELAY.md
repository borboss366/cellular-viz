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
  relay (`--serve`). The test relay is not conduct-serve. Do not restart conduct-serve.
- `experiments/relay-delay.html`: the same measurement in Chrome. The test relay
  serves it at `/`.
- `qa/runner/relay-test.sh`: starts and stops the test relay on the box, on a Unix
  socket in the bind-mounted data folder.

## 1. One machine (the box)

The box gives this number with every test run. `qa/runner/test/relay-delay.test.mjs`
measures 300 probes on an in-process relay and prints one line:
`# relay delay one machine: ...`. Copy the p50 and p99 into the table below.

To measure again by hand, inside the runner container:

1. Go to the runner clone (`$RUNNER_HOME`).
2. Run `node qa/relay-delay.mjs --self --n 600 --rate 20`.
3. Read the line that starts with `relay delay`.

## 2. Through the tunnel (the Mac and the box)

### On the box: start the test relay

1. On the box host, run this command:
   `podman exec --env-file ~/.config/cellular-viz-runner.env pi-durable-worker sh -c 'sh "$RUNNER_HOME/qa/runner/relay-test.sh"'`
2. Make sure that the output shows `relay-test: on /home/puggie/pi-durable-worker/data/relay-test.sock`.
3. Do not stop the conductor. The test relay is a different process.

### On the Mac: measure

1. Open Terminal.
2. Type this command and push Return:
   `ssh -N -L 8791:/home/puggie/pi-durable-worker/data/relay-test.sock puggie@192.168.8.164`
3. Keep this Terminal window open.
4. Open Chrome.
5. Go to `http://localhost:8791/`.
6. Make sure that the page shows "Relay delay".
7. Push **Start**.
8. Keep this tab in front. Do not use Chrome during the test. The test takes approximately 35 seconds.
9. Wait until the status shows "done".
10. Read the table. Write down p50 and p99 of "sender to receiver".
11. Push **Download**. Chrome saves a JSON file.
12. Give the JSON file to Orchestrator. The file has numbers only. It has no names.
13. Optional: set the rate to 60. Push **Start** again. Push **Download** again.
14. Close the Terminal window. This stops the tunnel.

If the status shows "the socket failed": make sure that the test relay runs on the box.
Then do step 2 again.

### On the box: stop the test relay

1. On the box host, run this command:
   `podman exec --env-file ~/.config/cellular-viz-runner.env pi-durable-worker sh -c 'sh "$RUNNER_HOME/qa/runner/relay-test.sh" stop'`
2. Make sure that the output shows `relay-test stopped`.

## 3. One machine (the Mac, optional)

Only if the Mac has node. Then you can measure without the box:

1. Open Terminal. Go to the clone of cellular-viz.
2. Run `node qa/relay-delay.mjs --serve --port 8791`.
3. In Chrome, go to `http://localhost:8791/`. Do steps 7 to 12 of section 2.
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
