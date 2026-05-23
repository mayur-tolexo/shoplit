#!/usr/bin/env bash
# Stop the detached shoplit Go services. Reads .pids/*.pid first; falls back
# to pkill by name so a missing PID file (shell crashed mid-run) doesn't leak
# processes.
set -euo pipefail

PIDS_DIR=.pids
stopped_any=0

for svc in api redirect; do
  pidfile="${PIDS_DIR}/${svc}.pid"
  if [[ -f "$pidfile" ]]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "stopped shoplit-${svc} (pid $pid)"
      stopped_any=1
    fi
    rm -f "$pidfile"
  fi
done

# Fallback: kill anything matching the binary path
if pkill -f "bin/shoplit-api" 2>/dev/null; then
  echo "stopped stray shoplit-api process(es) via pkill"
  stopped_any=1
fi
if pkill -f "bin/shoplit-redirect" 2>/dev/null; then
  echo "stopped stray shoplit-redirect process(es) via pkill"
  stopped_any=1
fi

if [[ $stopped_any -eq 0 ]]; then
  echo "(no shoplit go services were running)"
fi
