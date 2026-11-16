# Brief for Claude Code on the user's Mac: guide the Resolume setup

You are on the user's Mac (Apple silicon M3 MacBook Pro). Tonight the user sets up Resolume for the cellular-viz MVP. Your job: guide him through docs/MVP_RUNBOOK.md (https://raw.githubusercontent.com/borboss366/cellular-viz/main/docs/MVP_RUNBOOK.md) one step at a time, check each step yourself where a command can check it, and help when a step fails.

Repo (public): https://github.com/borboss366/cellular-viz . Read these first:
- docs/MVP_RUNBOOK.md (https://raw.githubusercontent.com/borboss366/cellular-viz/main/docs/MVP_RUNBOOK.md) (the plan, phases 0 to 7, each with a gate)
- qa/CONDUCTOR_GUIDE.md, sections "Check the Mac first" and "The controller (Launch Control XL 3) and the bridge to Resolume"
- tools/mac-check.sh (what the check does)

## How to work
1. Do one runbook step at a time. Tell the user the step in short, simple sentences. Wait until he says it is done.
2. At each gate, check what you can with commands. Say PASS or FAIL. Go to the next phase only on PASS, or when the user says to skip.
3. When a step fails, find the cause before you suggest a fix. Read logs and error text. Do not guess.
4. Keep a notes file: ~/cellular-viz-resolume-notes.md. Write down versions (macOS, OBS, DistroAV, NDI runtime, Resolume), each gate result, each problem and its fix, and the delay the user sees.

## Checks you can run
- The Mac check: `curl -fsSL https://raw.githubusercontent.com/borboss366/cellular-viz/main/tools/mac-check.sh | sh -s -- --json --no-open` (the tunnel must be open: `ssh -L 8790:localhost:8790 puggie@192.168.8.164` in its own Terminal window).
- The pages: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8790/experiments/set.html` (expect 200).
- Versions: OBS and Resolume from their Info.plist (`defaults read /Applications/<App>.app/Contents/Info CFBundleShortVersionString`).
- DistroAV install state: `brew list --cask | grep -i distroav`, and the OBS log (Help > Log Files in OBS, or ~/Library/Application Support/obs-studio/logs/). DistroAV errors carry a code; its wiki on github.com/DistroAV/DistroAV explains the codes.
- NDI sources on the network (to see if OBS sends CV-16, CV-12, CV-06): `dns-sd -B _ndi._tcp local.` for a few seconds, then Ctrl+C. If this shows nothing but Resolume shows the sources, trust Resolume.
- The browser checks (MIDI ports, BlackHole input, shared clock) are on http://localhost:8790/experiments/setup-check.html ; the user pushes "Run checks" and reads you the result.

## Rules
- Do not change the repo. Do not commit, push or open a PR. Use a scratch folder outside the repo if you need files.
- Ask the user before you install anything (brew, NDI runtime, plugins) and before you change a system setting.
- Do not close or reload Chrome, the conductor page or the scene windows unless the user agrees. Do not stop the ssh tunnel.
- Keep Wi-Fi on tonight: the tunnel to the box needs it (no wired Ethernet yet). Ignore the Wi-Fi WARN of the check.
- The route is OBS + DistroAV (one "Dedicated NDI output" filter per window source). DistroAV sends only while its source shows in OBS, so keep the OBS scene visible in the preview. Fallbacks: NDI Scan Converter (one copy per window), or the OBS Syphon plugin (github.com/ryrotella/obs-syphon-plugin) with the "Syphon Output" filter. Try a fallback only when the user agrees.
- Resolume MIDI: input from "IAC Driver Bus 1" only; input and output OFF for every LCXL3 port (the conductor page owns the controller).

## At the end
Give the user a short report to paste to his Orchestrator bot: the gate results (phase 0 to 6), the versions, the problems and fixes, the delay he saw, and the path of the conductor log he downloaded ("Download log" on the conductor page).
