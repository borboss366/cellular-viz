#!/bin/sh
# tools/mac-check.sh: check the show Mac before a set (the user, 16 Nov 15:57).
#
#   sh tools/mac-check.sh             all checks, then open the browser check page in Chrome
#   sh tools/mac-check.sh --no-open   do not open the browser check page
#   sh tools/mac-check.sh --json      the results as JSON (for Claude Code on the Mac)
#   MAC_CHECK_BASE=http://localhost:8790 sh tools/mac-check.sh   another server address
#
# One line per check: PASS / WARN / FAIL (INFO is not counted), the item, and for WARN / FAIL one fix step.
# The end: a count, and exit code 1 when a check FAILs. macOS built-ins only (sw_vers, sysctl, system_profiler, ls,
# defaults, pgrep, ps, curl, nc, networksetup, open); POSIX sh. Plain ASCII.
#
# Tests (qa/runner/test/setup-check.test.mjs) run it on Linux with MAC_CHECK_FAKE=<folder>: each command's output is
# read from a file in that folder, and the file system paths start at MAC_CHECK_ROOT.

BASE="${MAC_CHECK_BASE:-http://localhost:8790}"
FAKE="${MAC_CHECK_FAKE:-}"
ROOT="${MAC_CHECK_ROOT:-}"
HOMEDIR="${MAC_CHECK_HOME:-${HOME:-}}"
APPS="$ROOT/Applications"
TUNNEL='ssh -L 8790:localhost:8790 puggie@192.168.8.164'
PAGE="$BASE/experiments/setup-check.html"
OPEN=1
JSON=0

for a in "$@"; do
  case "$a" in
    --no-open) OPEN=0 ;;
    --json) JSON=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "unknown option: $a (use --no-open, --json)" >&2; exit 2 ;;
  esac
done

NPASS=0; NWARN=0; NFAIL=0; ROWS=''

# ---- output
esc() { printf '%s' "$1" | tr -d '\r\n\t' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
report() {   # status item detail [fix]
  st=$1; item=$2; detail=$3; fix=${4:-}
  case "$st" in PASS) NPASS=$((NPASS + 1)); fix='' ;; WARN) NWARN=$((NWARN + 1)) ;; FAIL) NFAIL=$((NFAIL + 1)) ;; *) fix='' ;; esac
  if [ "$JSON" -eq 1 ]; then
    r="{\"status\":\"$st\",\"item\":\"$(esc "$item")\",\"detail\":\"$(esc "$detail")\",\"fix\":\"$(esc "$fix")\"}"
    if [ -z "$ROWS" ]; then ROWS=$r; else ROWS="$ROWS,$r"; fi
  else
    if [ -n "$fix" ]; then printf '%-4s %s: %s. %s\n' "$st" "$item" "$detail" "$fix"; else printf '%-4s %s: %s\n' "$st" "$item" "$detail"; fi
  fi
}

# ---- commands (MAC_CHECK_FAKE: canned output from files)
out() {   # name command... : the command's output (stderr dropped)
  n=$1; shift
  if [ -n "$FAKE" ]; then [ -f "$FAKE/$n" ] && cat "$FAKE/$n"; return 0; fi
  "$@" 2>/dev/null
}
ok() {    # name command... : the command's exit status (fake: the file holds "yes")
  n=$1; shift
  if [ -n "$FAKE" ]; then [ -f "$FAKE/$n" ] && grep -q '^yes' "$FAKE/$n"; return; fi
  "$@" >/dev/null 2>&1
}
http() {  # path : the HTTP status code, 000 when there is no answer
  if [ -n "$FAKE" ]; then
    c=$(awk -v p="$1" '$1 == p { print $2; exit }' "$FAKE/http" 2>/dev/null)
    echo "${c:-000}"; return
  fi
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE$1" 2>/dev/null)
  echo "${c:-000}"
}
plistver() {  # app bundle path : CFBundleShortVersionString (fake: a line "CFBundleShortVersionString=1.2" in Info.plist)
  p="$1/Contents/Info.plist"
  [ -f "$p" ] || return 0
  if [ -n "$FAKE" ]; then sed -n 's/^CFBundleShortVersionString=//p' "$p" | head -n 1; return 0; fi
  defaults read "$1/Contents/Info" CFBundleShortVersionString 2>/dev/null
}

verlt() {  # a b : true when version a is below version b (dotted numbers; a missing part counts as 0)
  awk -v a="$1" -v b="$2" 'BEGIN { na = split(a, x, "."); nb = split(b, y, "."); n = na > nb ? na : nb
    for (i = 1; i <= n; i++) { p = x[i] + 0; q = y[i] + 0; if (p < q) exit 0; if (p > q) exit 1 } exit 1 }'
}

# ---- 1. macOS and the chip
ver=$(out sw_vers sw_vers -productVersion)
if [ -z "$ver" ]; then
  report FAIL "macOS" "sw_vers gives no version (not a Mac?)" "Run this tool on the show Mac"
else
  if ok arm64 sh -c '[ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = 1 ]'; then chip='Apple silicon'; else chip='Intel'; fi
  cpu=$(out cpu sysctl -n machdep.cpu.brand_string)
  major=${ver%%.*}
  case "$major" in ''|*[!0-9]*) major=0 ;; esac
  if [ "$major" -ge 12 ]; then report PASS "macOS" "macOS $ver, $chip${cpu:+ ($cpu)}"
  else report WARN "macOS" "macOS $ver, $chip${cpu:+ ($cpu)} is old" "Update macOS to version 12 or later"; fi
fi

# ---- 2. Google Chrome
chrome="$APPS/Google Chrome.app"
if [ -d "$chrome" ]; then
  v=$(plistver "$chrome")
  report PASS "Google Chrome" "installed, version ${v:-unknown}"
else
  report FAIL "Google Chrome" "not found in /Applications" "Install Google Chrome from google.com/chrome"
fi
# Chrome stops drawing a window that other windows cover fully (macOS occlusion), so OBS captures a still frame (the
# Resolume setup, 16 Nov). The main process (not the helpers) must run with the flag.
OCCL='--disable-backgrounding-occluded-windows'
cmain=$(out chrome_ps ps -axww -o command= | grep -E '/Google Chrome\.app/Contents/MacOS/Google Chrome( |$)')
nmain=$(printf '%s\n' "$cmain" | grep -c .)
nflag=$(printf '%s\n' "$cmain" | grep -c -e " $OCCL")
if [ "$nmain" -eq 0 ]; then
  report INFO "Chrome occlusion" "Chrome is not running. Start it with $OCCL before the scene windows"
elif [ "$nflag" -eq "$nmain" ]; then
  report PASS "Chrome occlusion" "Chrome runs with $OCCL"
else
  report WARN "Chrome occlusion" "Chrome runs without $OCCL: a fully covered scene window stops drawing and OBS captures a still frame" "Quit Chrome. Run: open -na \"Google Chrome\" --args $OCCL"
fi

# ---- 3. Audio: BlackHole 2ch, a Multi-Output Device, the default output
audio=$(out sp_audio system_profiler SPAudioDataType)
if printf '%s\n' "$audio" | grep -q 'BlackHole 2ch'; then report PASS "BlackHole 2ch" "present"
else report FAIL "BlackHole 2ch" "not found" "Install BlackHole 2ch from existential.audio"; fi
if printf '%s\n' "$audio" | grep -q 'Multi-Output Device'; then report PASS "Multi-Output Device" "present"
else report FAIL "Multi-Output Device" "not found" "Open Audio MIDI Setup. Click + and select Create Multi-Output Device. Select your speakers and BlackHole 2ch"; fi
defout=$(printf '%s\n' "$audio" | awk '/^        [^ ].*:$/ { n = $0; sub(/^ +/, "", n); sub(/:$/, "", n) } /Default Output Device: Yes/ { print n; exit }')
case "$defout" in
  *Multi-Output*) report PASS "Default output" "$defout" ;;
  '') report WARN "Default output" "not found" "Open System Settings, Sound, Output. Select the Multi-Output Device" ;;
  *) report WARN "Default output" "$defout is the default output, not the Multi-Output Device" "Open System Settings, Sound, Output. Select the Multi-Output Device" ;;
esac

# ---- 4. The Launch Control XL 3 on USB
usb=$(out sp_usb system_profiler SPUSBDataType)
usbh=$(out sp_usbhost system_profiler SPUSBHostDataType)
# system_profiler names it "LCXL3 1" on the show Mac (16 Nov), "Launch Control XL 3" elsewhere
lc=$(printf '%s\n%s\n' "$usb" "$usbh" | grep -Ei 'Launch Control|LCXL3' | head -n 1 | sed -e 's/^ *//' -e 's/:$//')
if [ -n "$lc" ]; then report PASS "LCXL3 on USB" "found: $lc"
else report WARN "LCXL3 on USB" "not found" "Connect the Launch Control XL 3 with a USB cable"; fi

# ---- 5. Displays
disp=$(out sp_displays system_profiler SPDisplaysDataType)
res=$(printf '%s\n' "$disp" | sed -n 's/^ *Resolution: *//p')
nd=$(printf '%s\n' "$res" | grep -c .)
reslist=$(printf '%s\n' "$res" | awk 'NF { printf "%s%s", (n++ ? "; " : ""), $0 }')
if [ "$nd" -ge 2 ]; then report PASS "Displays" "$nd displays: $reslist"
elif [ "$nd" -eq 1 ]; then report WARN "Displays" "1 display: $reslist (no projector)" "Connect the projector or the second display"
else report WARN "Displays" "no display found" "Connect the projector or the second display"; fi

# ---- 6. Resolume (installed; running is info only)
rfound=''
for pair in "Resolume Arena/Arena.app" "Resolume Avenue/Avenue.app" "Resolume Arena.app" "Resolume Avenue.app"; do
  if [ -d "$APPS/$pair" ]; then
    v=$(plistver "$APPS/$pair")
    rfound="${rfound:+$rfound, }${pair##*/} ${v:-version unknown}"
  fi
done
if [ -n "$rfound" ]; then report PASS "Resolume" "$rfound"
else report FAIL "Resolume" "Resolume Avenue or Arena not found in /Applications" "Install Resolume Avenue or Arena from resolume.com"; fi
if ok resolume_running sh -c 'pgrep -x Arena || pgrep -x Avenue'; then report INFO "Resolume running" "yes"; else report INFO "Resolume running" "no"; fi

# ---- 7. The capture route (FAIL only when no route is ready)
obs="$APPS/OBS.app"
plug_dirs="$ROOT/Library/Application Support/obs-studio/plugins|$ROOT$HOMEDIR/Library/Application Support/obs-studio/plugins"
plugin() {   # name pattern (case-insensitive) : the first plugin folder entry that matches, or nothing
  old=$IFS; IFS='|'
  for d in $plug_dirs; do
    [ -d "$d" ] || continue
    m=$(ls "$d" 2>/dev/null | grep -i -E "$1" | head -n 1)
    if [ -n "$m" ]; then IFS=$old; echo "$m"; return 0; fi
  done
  IFS=$old
}
ndilib=''
for f in "$ROOT/usr/local/lib/libndi.dylib" "$ROOT/Library/NDI SDK for Apple/lib/macOS/libndi.dylib" "$ROOT/Library/NDI/lib/libndi.dylib"; do
  if [ -e "$f" ]; then ndilib=$f; break; fi
done
routes=0
# (c) NDI Tools for Mac with NDI Scan Converter (VIZ research's Resolume routing, 16 Nov: the first choice; it brings
# its own NDI library): "NDI Scan Converter" (or its newer name "NDI Screen Capture") in /Applications or in an
# "NDI Tools" folder there, or the "NDI Tools" folder itself
scan=$( { ls "$APPS"; ls "$APPS/NDI Tools"; } 2>/dev/null | grep -i -E 'NDI.*(Scan Converter|Screen Capture)' | head -n 1)
if [ -n "$scan" ]; then
  report PASS "Capture route NDI Scan Converter" "$scan"; routes=$((routes + 1))
elif [ -d "$APPS/NDI Tools" ]; then
  report PASS "Capture route NDI Scan Converter" "NDI Tools folder in /Applications (NDI Scan Converter not seen in it)"; routes=$((routes + 1))
else
  report INFO "Capture route NDI Scan Converter" "not ready: NDI Scan Converter not found"
fi
if [ -n "$scan" ] || [ -d "$APPS/NDI Tools" ]; then
  report INFO "Scan Converter" "Scan Converter sends one window per instance. Three scenes need three instances, or use OBS + DistroAV"
fi
# (a) OBS + the DistroAV plugin (or the older obs-ndi) + the NDI runtime. DistroAV 6.2.x needs OBS 31.1.1 or later and
# the NDI runtime 6.3 or later (DistroAV 6.2.0 release notes)
if [ -d "$obs" ]; then obsv=$(plistver "$obs"); obstxt="OBS ${obsv:-version unknown}"; else obstxt='OBS not found'; fi
distro=$(plugin 'distroav|obs-ndi')
if [ -d "$obs" ] && [ -n "$distro" ] && [ -n "$ndilib" ]; then
  report PASS "Capture route OBS NDI" "$obstxt, plugin $distro, NDI runtime"; routes=$((routes + 1))
else
  report INFO "Capture route OBS NDI" "not ready: $obstxt; DistroAV plugin ${distro:-not found}; NDI runtime $( [ -n "$ndilib" ] && echo found || echo 'not found')"
fi
if [ -d "$obs" ]; then
  if [ -z "$obsv" ]; then report INFO "OBS version" "not found"
  elif verlt "$obsv" 31.1.1; then report WARN "OBS version" "OBS $obsv is below 31.1.1 (DistroAV 6.2 needs 31.1.1 or later)" "Update OBS to 31.1.1 or later from obsproject.com"
  else report PASS "OBS version" "OBS $obsv (DistroAV 6.2 needs 31.1.1 or later)"; fi
fi
if [ -d "$obs" ] || [ -n "$ndilib" ]; then
  report INFO "NDI runtime version" "not found (DistroAV 6.2 needs 6.3 or later; check it in the NDI installer)"
fi
# (b) Syphon: OBS + a syphon plugin, or a Syphon app in /Applications
syph=$(plugin 'syphon')
syapp=$(ls "$APPS" 2>/dev/null | grep -i 'syphon' | head -n 1)
if [ -d "$obs" ] && [ -n "$syph" ]; then
  report PASS "Capture route Syphon" "$obstxt, plugin $syph"; routes=$((routes + 1))
elif [ -n "$syapp" ]; then
  report PASS "Capture route Syphon" "$syapp in /Applications"; routes=$((routes + 1))
else
  report INFO "Capture route Syphon" "not ready: $obstxt; Syphon plugin not found; no Syphon app in /Applications"
fi
if [ "$routes" -eq 0 ]; then
  report FAIL "Capture route" "no route is ready (NDI Scan Converter, OBS with NDI, or Syphon)" "Install NDI Tools from ndi.video. Or install OBS from obsproject.com, then DistroAV and the NDI runtime"
fi
# NDI and the network: Wi-Fi on is a WARN; the Local Network permission cannot be read from the shell (INFO)
wdev=$(out wifi_ports networksetup -listallhardwareports | awk '/^Hardware Port: (Wi-Fi|AirPort)$/ { f = 1; next } f && /^Device:/ { print $2; exit }')
if [ -z "$wdev" ]; then
  report INFO "Wi-Fi" "no Wi-Fi device found"
else
  wp=$(out wifi_power networksetup -getairportpower "$wdev")
  case "$wp" in
    *": On"*) report WARN "Wi-Fi" "Wi-Fi ($wdev) is on" "Turn off Wi-Fi while you set up NDI. NDI on a Mac uses Wi-Fi when it is on" ;;
    *": Off"*) report PASS "Wi-Fi" "Wi-Fi ($wdev) is off" ;;
    *) report INFO "Wi-Fi" "the Wi-Fi state ($wdev) is not known" ;;
  esac
fi
report INFO "Local Network" "Allow Resolume in System Settings > Privacy & Security > Local Network"

# ---- 8. The tunnel and the pages
if ok tunnel nc -z -G 2 localhost 8790; then
  report PASS "Tunnel" "port 8790 is open on localhost"
  set_json=$(if [ -n "$FAKE" ]; then out set_json true; else curl -s --max-time 5 "$BASE/experiments/set.json" 2>/dev/null; fi)
  scenes=$(printf '%s\n' "$set_json" | grep -o '"page"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
  bad=0; n=0
  for p in clock-conductor.html set.html set.json $scenes; do
    n=$((n + 1)); c=$(http "/experiments/$p")
    if [ "$c" != 200 ]; then bad=$((bad + 1)); report FAIL "Page $p" "HTTP $c" "Start the server on the box. Then run this tool again"; fi
  done
  if [ -z "$scenes" ]; then report WARN "Scenes" "set.json lists no scene" "Check experiments/set.json on the box"; fi
  if [ "$bad" -eq 0 ]; then report PASS "Pages" "$n pages answer HTTP 200 (conductor, set, set.json, $(printf '%s\n' "$scenes" | grep -c .) scenes)"; fi
else
  report FAIL "Tunnel" "port 8790 is not open on localhost" "Open the tunnel: $TUNNEL"
fi

# ---- the end: the count, then the browser check page
NEXT="In Chrome, push Run checks. Look at: WebGL2 and the GPU, the LCXL3 DAW ports and IAC Driver Bus 1, BlackHole as an audio input, the shared clock (open the conductor page and push Play first), the panic channel."
if [ "$JSON" -eq 1 ]; then
  printf '{"tool":"mac-check","version":1,"base":"%s","results":[%s],"summary":{"pass":%d,"warn":%d,"fail":%d},"browserCheck":"%s","next":"%s"}\n' \
    "$(esc "$BASE")" "$ROWS" "$NPASS" "$NWARN" "$NFAIL" "$(esc "$PAGE")" "$(esc "$NEXT")"
else
  echo "Summary: $NPASS PASS, $NWARN WARN, $NFAIL FAIL"
fi
if [ "$OPEN" -eq 1 ] && [ -z "$FAKE" ]; then
  open -a "Google Chrome" "$PAGE" 2>/dev/null || [ "$JSON" -eq 1 ] || echo "Could not open Chrome. Open $PAGE in Chrome."
fi
if [ "$JSON" -eq 0 ]; then
  echo "Browser check: $PAGE"
  echo "$NEXT"
fi
[ "$NFAIL" -eq 0 ]
