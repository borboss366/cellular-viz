#!/bin/sh
# The QA viewer at :8787, for the cellular-viz-viewer systemd unit (inside Puggie's container, like the runner).
# It runs main's qa/serve.mjs from this clone (RUNNER_HOME, updated by qa/update-runner.sh) on QA box's data in QA_HOME
# (runs, grades, builds). All logic lives here, so the unit file never has to change.
#   sh viewer.sh          start (stops an older viewer and a stale socket first)
#   sh viewer.sh stop     stop it and wait until it is gone (the unit's ExecStop)
#   QA_HOME        QA box's working copy (required)
#   VIEWER_PORT    default 8787 (inside the container; nothing is published on the host)
#   VIEWER_SOCKET  the Unix socket the host's systemd-socket-proxyd forwards :8787 to (default: qa-viewer.sock next to
#                  RUNNER_SOCKET)
#   RUNNER_STATE   viewer.pid goes here, so qa/update-runner.sh can restart the viewer
set -eu
HOME_DIR=$(cd "$(dirname "$0")/../.." && pwd)     # the clone this script lives in = RUNNER_HOME (main)
STATE=${RUNNER_STATE:-$HOME/.cache/cellular-viz-runner}

if [ "${1:-}" = "stop" ]; then
  p=$(cat "$STATE/viewer.pid" 2>/dev/null || true)
  [ -n "$p" ] || exit 0
  kill -TERM "$p" 2>/dev/null || exit 0
  i=0; while kill -0 "$p" 2>/dev/null && [ "$i" -lt 50 ]; do sleep 0.2; i=$((i + 1)); done
  exit 0
fi

: "${QA_HOME:?QA_HOME not set}"
PORT=${VIEWER_PORT:-8787}
SOCK=${VIEWER_SOCKET:-}
# not set: next to the runner's API socket (data/qa-viewer.sock today), so the host's env file needs no new line
if [ -z "$SOCK" ] && [ -n "${RUNNER_SOCKET:-}" ]; then SOCK="$(dirname "$RUNNER_SOCKET")/qa-viewer.sock"; fi
mkdir -p "$STATE"

# A viewer started some other way (the old nohup one, or one systemd lost track of) holds the port: stop it first.
# Only node processes running qa/serve.mjs: never a grep or a shell that merely mentions the path.
for d in /proc/[0-9]*; do
  p=${d#/proc/}
  [ "$p" = "$$" ] && continue
  a0=$(tr '\0' '\n' < "$d/cmdline" 2>/dev/null | head -n 1 || true)
  case "$a0" in node|*/node) ;; *) continue ;; esac
  case "$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null || true)" in
    *" qa/serve.mjs"*|*"/qa/serve.mjs"*) echo "stopping an older viewer, pid $p"; kill -TERM "$p" 2>/dev/null || true ;;
  esac
done
sleep 1
# a socket file left behind by a crash makes listen fail
if [ -n "$SOCK" ]; then rm -f "$SOCK"; fi

cd "$QA_HOME"
export QA_HOME
echo $$ > "$STATE/viewer.pid"          # exec keeps this pid for node
if [ -n "$SOCK" ]; then
  exec node "$HOME_DIR/qa/serve.mjs" --port "$PORT" --socket "$SOCK"
else
  exec node "$HOME_DIR/qa/serve.mjs" --port "$PORT"
fi
