#!/bin/sh
# Update the QA runner: pull its clone, then stop the running runner and the viewer; systemd starts both again.
# Run it INSIDE Puggie's worker container (QA box's shell), where the runner and viewer run; on the host it refuses.
# Nothing else. QA box types it the same way every time, from the runner's clone (RUNNER_HOME):
#   sh /path/to/cellular-viz-runner/qa/update-runner.sh
set -eu
HOME_DIR=$(cd "$(dirname "$0")/.." && pwd)        # the clone this script lives in = RUNNER_HOME
ENV_FILE=${RUNNER_ENV:-$HOME/.config/cellular-viz-runner.env}

# On the host this would pull the clone and stop nothing (the runner's pid file is inside the container), which looks
# like success. Podman marks every container with /run/.containerenv (and $container); without either, refuse.
if [ ! -e /run/.containerenv ] && [ -z "${container:-}" ]; then
  C=""
  [ -f "$ENV_FILE" ] && C=$(sed -n 's/^CONTAINER=//p' "$ENV_FILE" | tail -n 1 | tr -d '"')
  C=${C:-pi-durable-worker}
  echo "update-runner.sh: this is not Puggie's container, so nothing was pulled or restarted." >&2
  echo "Run it in QA box's shell, or from the host:" >&2
  echo "  podman exec --env-file $ENV_FILE $C sh $HOME_DIR/qa/update-runner.sh" >&2
  exit 2
fi

STATE=${RUNNER_STATE:-}
[ -z "$STATE" ] && [ -f "$ENV_FILE" ] && STATE=$(sed -n 's/^RUNNER_STATE=//p' "$ENV_FILE" | tail -n 1)
STATE=${STATE:-$HOME/.cache/cellular-viz-runner}

git -C "$HOME_DIR" pull -q --ff-only
echo "runner code: $(git -C "$HOME_DIR" log -1 --format='%h %s')"
PID=$(cat "$STATE/runner.pid" 2>/dev/null || true)
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill -TERM "$PID"
  echo "stopped runner $PID; systemd starts the new code within 30 s"
else
  echo "no runner running (service off?); qa/run-next.sh uses the new code"
fi
# the viewer (cellular-viz-viewer service) runs this clone's qa/serve.mjs: restart it so it picks up the pulled code
VPID=$(cat "$STATE/viewer.pid" 2>/dev/null || true)
if [ -n "$VPID" ] && kill -0 "$VPID" 2>/dev/null && tr '\0' ' ' < "/proc/$VPID/cmdline" 2>/dev/null | grep -q 'qa/serve\.mjs'; then
  kill -TERM "$VPID"
  echo "stopped viewer $VPID; systemd starts it again within 5 s"
else
  echo "no viewer service running (not installed yet?)"
fi
