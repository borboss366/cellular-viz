#!/bin/sh
# The conductor page at :8790 on the box (#188), for the user's listening sessions from the laptop. It runs main's
# qa/conduct-serve.mjs from this clone (RUNNER_HOME, updated by qa/update-runner.sh) inside Puggie's container, on a
# Unix socket in the bind-mounted data folder; the host's cellular-viz-conductor.socket/.service forward :8790 to it.
# Started by hand before a session (qa/runner/README.md, "Conductor page"):
#   podman exec -d --env-file ~/.config/cellular-viz-runner.env pi-durable-worker sh -c 'sh "$RUNNER_HOME/qa/runner/conductor.sh"'
#   sh conductor.sh          start (stops an older one and a stale socket first)
#   sh conductor.sh stop     stop it and wait until it is gone
# From the runner env file (R9: the private paths live only there, never in git):
#   CONDUCTOR_TRACKS    the private tracks folder (required)
#   CONDUCTOR_SESSIONS  where the session logs go (default: sessions/ beside the tracks folder)
#   CONDUCTOR_SOCKET    the socket (default: conductor.sock next to RUNNER_SOCKET; without RUNNER_SOCKET,
#                       /home/puggie/pi-durable-worker/data/conductor.sock, what cellular-viz-conductor.service forwards to)
#   RUNNER_STATE        conductor.pid and conductor.log go here
set -eu
HOME_DIR=$(cd "$(dirname "$0")/../.." && pwd)     # the clone this script lives in = RUNNER_HOME (main)
STATE=${RUNNER_STATE:-$HOME/.cache/cellular-viz-runner}

# is pid $1 a node process running qa/conduct-serve.mjs? (never a grep or a shell that merely mentions the path)
is_conductor() {
  a0=$(tr '\0' '\n' < "/proc/$1/cmdline" 2>/dev/null | head -n 1 || true)
  case "$a0" in node|*/node) ;; *) return 1 ;; esac
  case "$(tr '\0' ' ' < "/proc/$1/cmdline" 2>/dev/null || true)" in *" qa/conduct-serve.mjs"*|*"/qa/conduct-serve.mjs"*) return 0 ;; esac
  return 1
}
stop_all() {
  for d in /proc/[0-9]*; do
    p=${d#/proc/}
    [ "$p" = "$$" ] && continue
    if is_conductor "$p"; then
      kill -TERM "$p" 2>/dev/null || true
      i=0; while kill -0 "$p" 2>/dev/null && [ "$i" -lt 50 ]; do sleep 0.2; i=$((i + 1)); done
    fi
  done
}

if [ "${1:-}" = "stop" ]; then stop_all; rm -f "$STATE/conductor.pid"; echo "conductor stopped"; exit 0; fi

: "${CONDUCTOR_TRACKS:?CONDUCTOR_TRACKS not set: add it to ~/.config/cellular-viz-runner.env (qa/runner/README.md)}"
SOCK=${CONDUCTOR_SOCKET:-}
# not set: next to RUNNER_SOCKET, else the data folder the host unit forwards to (bind-mounted at the same path)
if [ -z "$SOCK" ] && [ -n "${RUNNER_SOCKET:-}" ]; then SOCK="$(dirname "$RUNNER_SOCKET")/conductor.sock"; fi
SOCK=${SOCK:-/home/puggie/pi-durable-worker/data/conductor.sock}
mkdir -p "$STATE"
stop_all
rm -f "$SOCK"

set -- --dir "$CONDUCTOR_TRACKS" --socket "$SOCK"
if [ -n "${CONDUCTOR_SESSIONS:-}" ]; then set -- "$@" --sessions "$CONDUCTOR_SESSIONS"; fi
cd "$HOME_DIR"
echo $$ > "$STATE/conductor.pid"          # exec keeps this pid for node
echo "conductor: starting on $SOCK ($(date -u +%FT%TZ))" >> "$STATE/conductor.log"
exec node "$HOME_DIR/qa/conduct-serve.mjs" "$@" >> "$STATE/conductor.log" 2>&1
