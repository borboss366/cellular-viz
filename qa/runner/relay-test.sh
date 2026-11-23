#!/bin/sh
# A separate TEST relay on the box for the relay delay report (docs/BEAT_RELAY_DELAY.md; beat server brief task 6).
# Not conduct-serve: the conductor keeps running and is not restarted. It runs qa/relay-delay.mjs --serve from this
# clone inside Puggie's container, on a Unix socket in the bind-mounted data folder, so the Mac reaches it with an SSH
# tunnel to that socket (ssh -L 8791:<socket> puggie@<box>); it serves the measure page at / and the relay at /relay.
#   sh relay-test.sh          start (stops an older one first); prints the socket path
#   sh relay-test.sh stop     stop it
#   RELAY_TEST_SOCKET   the socket (default: relay-test.sock next to RUNNER_SOCKET, else
#                       /home/puggie/pi-durable-worker/data/relay-test.sock)
#   RUNNER_STATE        relay-test.pid and relay-test.log go here
set -eu
HOME_DIR=$(cd "$(dirname "$0")/../.." && pwd)
STATE=${RUNNER_STATE:-$HOME/.cache/cellular-viz-runner}
SOCK=${RELAY_TEST_SOCKET:-}
if [ -z "$SOCK" ] && [ -n "${RUNNER_SOCKET:-}" ]; then SOCK="$(dirname "$RUNNER_SOCKET")/relay-test.sock"; fi
SOCK=${SOCK:-/home/puggie/pi-durable-worker/data/relay-test.sock}
mkdir -p "$STATE"

stop_it() {
  if [ -f "$STATE/relay-test.pid" ]; then
    p=$(cat "$STATE/relay-test.pid" 2>/dev/null || true)
    case "$(tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null || true)" in
      *qa/relay-delay.mjs*) kill -TERM "$p" 2>/dev/null || true
        i=0; while kill -0 "$p" 2>/dev/null && [ "$i" -lt 25 ]; do sleep 0.2; i=$((i + 1)); done ;;
    esac
    rm -f "$STATE/relay-test.pid"
  fi
  rm -f "$SOCK"
}

if [ "${1:-}" = "stop" ]; then stop_it; echo "relay-test stopped"; exit 0; fi
stop_it
cd "$HOME_DIR"
echo "relay-test: starting on $SOCK ($(date -u +%FT%TZ))" >> "$STATE/relay-test.log"
nohup node "$HOME_DIR/qa/relay-delay.mjs" --serve --socket "$SOCK" >> "$STATE/relay-test.log" 2>&1 &
echo $! > "$STATE/relay-test.pid"
i=0; while [ ! -S "$SOCK" ] && [ "$i" -lt 50 ]; do sleep 0.1; i=$((i + 1)); done
if [ -S "$SOCK" ]; then echo "relay-test: on $SOCK"; else echo "relay-test: no socket after 5 s (see $STATE/relay-test.log)"; exit 1; fi
