#!/usr/bin/env bash
# Stop the detached shoplit dev stack (go services + next.js web). Reads
# .pids/*.pid first; falls back to pkill by name so a missing PID file
# (shell crashed mid-run) doesn't leak processes.
set -euo pipefail

PIDS_DIR=.pids
stopped_any=0

# Phase 1: kill the tracked parent PIDs from .pids/. pnpm forwards SIGTERM to
# its child `next dev`, which kills its own workers — so this should be a
# complete shutdown for the happy path.
for svc in api redirect web; do
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

# Give the parent SIGTERMs a moment to propagate to children before we go
# looking for leftovers — avoids noisy "stray" messages on a clean shutdown.
sleep 0.5

# Phase 2: defensive fallback. Anything matching these names that's still
# alive is a real leftover (parent died without cleaning up, PID file lost,
# etc.). Only print when we actually kill something.
for pattern in "bin/shoplit-api" "bin/shoplit-redirect" "pnpm.*-C.*web.*dev" "node.*next/dist/bin/next" "next-server"; do
  if pkill -f "$pattern" 2>/dev/null; then
    echo "  (also killed leftover process matching: $pattern)"
    stopped_any=1
  fi
done

if [[ $stopped_any -eq 0 ]]; then
  echo "(no shoplit services were running)"
fi
