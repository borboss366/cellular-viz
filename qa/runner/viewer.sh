#!/bin/sh
# Runs the QA viewer at :8787 for the cellular-viz-viewer systemd unit (inside Puggie's container, like the runner).
# The viewer is QA box's qa/serve.mjs in QA_HOME (its branch): it reads and writes the runs, grades and builds there.
#   QA_HOME        QA box's working copy (required)
#   VIEWER_PORT    default 8787
#   VIEWER_SOCKET  the Unix socket the host's systemd-socket-proxyd forwards :8787 to (default: qa-viewer.sock next to
#                  RUNNER_SOCKET)
#   RUNNER_STATE   viewer.pid goes here, so qa/update-runner.sh can restart the viewer
set -eu
: "${QA_HOME:?QA_HOME not set}"
STATE=${RUNNER_STATE:-$HOME/.cache/cellular-viz-runner}
PORT=${VIEWER_PORT:-8787}
SOCK=${VIEWER_SOCKET:-}
# not set: next to the runner's API socket (data/qa-viewer.sock today), so the host's env file needs no new line
if [ -z "$SOCK" ] && [ -n "${RUNNER_SOCKET:-}" ]; then SOCK="$(dirname "$RUNNER_SOCKET")/qa-viewer.sock"; fi
mkdir -p "$STATE"

# A viewer started some other way (the old nohup one, or one systemd lost track of) holds the port: stop it first.
for d in /proc/[0-9]*; do
  p=${d#/proc/}
  [ "$p" = "$$" ] && continue
  case "$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null || true)" in
    *qa/serve.mjs*) echo "stopping an older viewer, pid $p"; kill -TERM "$p" 2>/dev/null || true ;;
  esac
done
sleep 1
# a socket file left behind by a crash makes listen fail
if [ -n "$SOCK" ]; then rm -f "$SOCK"; fi

cd "$QA_HOME"
echo $$ > "$STATE/viewer.pid"          # exec keeps this pid for node
if [ -n "$SOCK" ]; then
  exec node qa/serve.mjs --port "$PORT" --socket "$SOCK"
else
  exec node qa/serve.mjs --port "$PORT"
fi
