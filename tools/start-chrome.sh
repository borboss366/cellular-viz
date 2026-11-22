#!/bin/sh
# tools/start-chrome.sh: start Chrome on the show Mac with the flags the set needs (the user, 22 Nov).
#
#   sh tools/start-chrome.sh                start Chrome with the flags (nothing to do when it already runs with them)
#   sh tools/start-chrome.sh URL...         the same, then open these pages
#   sh tools/start-chrome.sh --restart      Chrome runs without the flags: quit it, then start it with them
#   sh tools/start-chrome.sh --dry-run      print what it would do, change nothing
#
# The flags: --disable-backgrounding-occluded-windows (macOS occlusion: Chrome stops drawing a fully covered window and
# OBS captures a still frame, the Resolume setup 16 Nov) and --autoplay-policy=no-user-gesture-required (the guest DJ
# runbook). Chrome reads flags only at start, so a running Chrome without them must quit first. Quitting closes every
# Chrome window: the scene windows come back with new ids, so re-pick each window in OBS afterwards.
#
# Tests (qa/runner/test/start-chrome.test.mjs) run it with START_CHROME_PS=<file> (the ps output) and --dry-run.

FLAGS='--disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required'
MAIN_RE='/Google Chrome\.app/Contents/MacOS/Google Chrome( |$)'
FAKE_PS="${START_CHROME_PS:-}"
RESTART=0
DRY=0
URLS=''

for a in "$@"; do
  case "$a" in
    --restart) RESTART=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    -*) echo "unknown option: $a (use --restart, --dry-run)" >&2; exit 2 ;;
    *) URLS="${URLS:+$URLS }$a" ;;
  esac
done

chrome_main() {  # the main Chrome process's command lines (helpers do not count)
  if [ -n "$FAKE_PS" ]; then cat "$FAKE_PS" 2>/dev/null; else ps -axww -o command= 2>/dev/null; fi | grep -E "$MAIN_RE"
}
has_flags() {    # true when every main process carries every flag
  m=$(chrome_main)
  [ -n "$m" ] || return 1
  for f in $FLAGS; do
    [ "$(printf '%s\n' "$m" | grep -c -e " $f")" -eq "$(printf '%s\n' "$m" | grep -c .)" ] || return 1
  done
}
run() {          # print the command; run it unless --dry-run
  echo "> $*"
  [ "$DRY" -eq 1 ] || "$@"
}
open_urls() {
  [ -n "$URLS" ] || return 0
  # shellcheck disable=SC2086 (one word per URL)
  run open -a "Google Chrome" $URLS
}

if [ -n "$(chrome_main)" ]; then
  if has_flags; then
    echo "OK: Chrome already runs with $FLAGS"
    open_urls
    exit 0
  fi
  if [ "$RESTART" -eq 0 ]; then
    echo "Chrome runs without $FLAGS."
    echo "Quitting it closes every Chrome window (scene windows too: re-pick them in OBS afterwards)."
    echo "To quit and start it again: sh tools/start-chrome.sh --restart"
    exit 1
  fi
  run osascript -e 'quit app "Google Chrome"'
  if [ "$DRY" -eq 0 ]; then
    i=0
    while [ -n "$(chrome_main)" ]; do
      i=$((i + 1))
      if [ "$i" -gt 30 ]; then echo "Chrome did not quit in 15 s (a dialog open?). Quit it by hand, then run this again." >&2; exit 1; fi
      sleep 0.5
    done
  fi
fi

# shellcheck disable=SC2086 (one word per flag and URL)
run open -na "Google Chrome" --args $FLAGS $URLS
if [ "$DRY" -eq 0 ]; then
  i=0
  until has_flags; do
    i=$((i + 1))
    if [ "$i" -gt 20 ]; then echo "FAIL: Chrome is not running with $FLAGS after 10 s. Check it with: sh tools/mac-check.sh --no-open" >&2; exit 1; fi
    sleep 0.5
  done
  echo "OK: Chrome runs with $FLAGS"
fi
