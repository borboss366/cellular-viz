#!/bin/sh
# tools/start-beatd.sh: start beatd on the show Mac (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 2), in the style of
# tools/start-chrome.sh.
#
#   sh tools/start-beatd.sh                       the fake metronome at 120 bpm, to the relay through the tunnel
#   sh tools/start-beatd.sh --source fake:128     any beatd arguments (python3 -m beatd --help)
#   sh tools/start-beatd.sh --dry-run             print the command, run nothing
#
# The relay is conduct-serve's on the box, reached through the normal tunnel (ssh -L 8790:localhost:8790 ...):
# ws://127.0.0.1:8790/relay?v=1 (BEATD_RELAY to change it). beatd uses the standard library only for now, so nothing
# is installed. Stop it with Control-C; if it stops, the pages and the conductor carry on without it.
HERE=$(cd "$(dirname "$0")/.." && pwd)
RELAY=${BEATD_RELAY:-ws://127.0.0.1:8790/relay?v=1}
DRY=0 HAS_SRC=0 HAS_RELAY=0
for a do
  shift
  case $a in
    --dry-run) DRY=1; continue ;;
    --source|--source=*) HAS_SRC=1 ;;
    --relay|--relay=*) HAS_RELAY=1 ;;
  esac
  set -- "$@" "$a"
done
[ "$HAS_RELAY" = 1 ] || set -- --relay "$RELAY" "$@"
[ "$HAS_SRC" = 1 ] || set -- "$@" --source fake:120
if [ "$DRY" = 1 ]; then echo "cd $HERE && python3 -m beatd $*"; exit 0; fi
command -v python3 >/dev/null 2>&1 || { echo "start-beatd: no python3 (install Python 3.11)" >&2; exit 1; }
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || { echo "start-beatd: $(python3 -V 2>&1) is too old (3.9+)" >&2; exit 1; }
cd "$HERE" || exit 1
exec python3 -m beatd "$@"
