#!/bin/sh
# Is something else using the box's GPU? (amdgpu sysfs, readable from inside the container) — run before any GPU check
for i in 1 2 3 4 5 6; do echo "$(date +%T) busy $(cat /sys/class/drm/card0/device/gpu_busy_percent)% vram $(( $(cat /sys/class/drm/card0/device/mem_info_vram_used)/1048576 )) MiB gtt $(( $(cat /sys/class/drm/card0/device/mem_info_gtt_used)/1048576 )) MiB"; sleep 5; done
ps -eo args | grep -iE "chrom|headless_shell|qa/check-" | grep -v grep | head
