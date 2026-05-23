#!/usr/bin/env bash
# Start both shoplit Go binaries in the background. Logs go to .logs/, PIDs to
# .pids/. The script returns to the caller's prompt as soon as both processes
# are confirmed alive — `make up` is fully detached.
#
# Idempotent: if instances are already running, they're stopped first so the
# freshly-built binaries take effect.
set -euo pipefail

PIDS_DIR=.pids
LOGS_DIR=.logs
mkdir -p "$PIDS_DIR" "$LOGS_DIR"

# Stop any prior instance so the new binary actually takes effect.
for svc in api redirect; do
  pidfile="${PIDS_DIR}/${svc}.pid"
  if [[ -f "$pidfile" ]]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
done
# Belt and suspenders: pkill anything matching the binary names, in case the
# PID file went missing (e.g. shell crashed before stop.sh ran).
pkill -f "bin/shoplit-api" 2>/dev/null || true
pkill -f "bin/shoplit-redirect" 2>/dev/null || true
sleep 0.3   # let ports free up

# Launch detached. `nohup` so they survive the parent shell closing.
nohup ./bin/shoplit-api >"${LOGS_DIR}/api.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "${PIDS_DIR}/api.pid"

nohup ./bin/shoplit-redirect >"${LOGS_DIR}/redirect.log" 2>&1 &
REDIRECT_PID=$!
echo "$REDIRECT_PID" > "${PIDS_DIR}/redirect.pid"

# Wait up to 8s for /health to respond on each service. This catches both
# "process crashed before listening" and the race where the process exists
# but hasn't yet bound its port.
wait_for_health() {
  local name=$1 url=$2 pid=$3 logfile=$4
  local deadline=$(( $(date +%s) + 8 ))
  while [[ $(date +%s) -lt $deadline ]]; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "✗ shoplit-${name} died during startup (pid $pid). last 20 lines:"
      tail -20 "$logfile"
      return 1
    fi
    if curl -sf -o /dev/null --max-time 1 "$url"; then
      return 0
    fi
    sleep 0.2
  done
  echo "✗ shoplit-${name} did not respond at ${url} within 8s. last 20 lines:"
  tail -20 "$logfile"
  return 1
}

if ! wait_for_health api http://localhost:8080/health "$API_PID" "${LOGS_DIR}/api.log"; then
  kill "$API_PID" "$REDIRECT_PID" 2>/dev/null || true
  rm -f "${PIDS_DIR}/api.pid" "${PIDS_DIR}/redirect.pid"
  exit 1
fi
if ! wait_for_health redirect http://localhost:8081/health "$REDIRECT_PID" "${LOGS_DIR}/redirect.log"; then
  kill "$API_PID" "$REDIRECT_PID" 2>/dev/null || true
  rm -f "${PIDS_DIR}/api.pid" "${PIDS_DIR}/redirect.pid"
  exit 1
fi

echo "✓ shoplit-api      → http://localhost:8080  (pid $API_PID,  logs: ${LOGS_DIR}/api.log)"
echo "✓ shoplit-redirect → http://localhost:8081  (pid $REDIRECT_PID, logs: ${LOGS_DIR}/redirect.log)"
echo ""
echo "  make logs   # tail both go service logs"
echo "  make down   # stop everything"
