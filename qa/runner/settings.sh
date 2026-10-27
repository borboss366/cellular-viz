# Sourced by the fixed qa/*.sh scripts: the runner's settings inside the container.
# RUNNER_ENV or ~/.config/cellular-viz-runner.env if there, else the copy the service writes at every start
# (~/.cache/cellular-viz-runner/runner.env). Sets HOME_DIR to the clone the scripts live in (RUNNER_HOME).
HOME_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE=${RUNNER_ENV:-$HOME/.config/cellular-viz-runner.env}
[ -f "$ENV_FILE" ] || ENV_FILE=$HOME/.cache/cellular-viz-runner/runner.env
if [ ! -f "$ENV_FILE" ]; then
  echo "no runner settings: start the service once (it writes $ENV_FILE) or put the env file at ~/.config/cellular-viz-runner.env" >&2
  exit 1
fi
set -a; . "$ENV_FILE"; set +a
