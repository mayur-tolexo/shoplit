#!/usr/bin/env bash
# Start the full shoplit dev stack in the background:
# - shoplit-api      (Go)        on :8080
# - shoplit-redirect (Go)        on :8081
# - shoplit-web      (Next.js)   on :3000
# Logs go to .logs/, PIDs to .pids/. The script returns to the caller as soon
# as all three services are confirmed responding — `make up` is fully detached.
#
# Compatibility notes:
# - macOS ships bash 3.2 (Apple won't ship newer for GPLv3 reasons), so we
#   avoid `wait -n` (bash 4.3+) and use `kill -0` polling instead.
# - Next.js dev compiles routes lazily on first request, so we give the web
#   service a longer health-wait deadline than the Go services.
set -euo pipefail

PIDS_DIR=.pids
LOGS_DIR=.logs
mkdir -p "$PIDS_DIR" "$LOGS_DIR"

# Stop any prior instance so freshly-built binaries take effect.
for svc in api redirect web; do
  pidfile="${PIDS_DIR}/${svc}.pid"
  if [[ -f "$pidfile" ]]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
done
# Belt and suspenders: pkill anything matching binary/process names, in case
# the PID file went missing (shell crashed before stop.sh ran, etc.).
pkill -f "bin/shoplit-api" 2>/dev/null || true
pkill -f "bin/shoplit-redirect" 2>/dev/null || true
pkill -f "pnpm.*-C.*web.*dev" 2>/dev/null || true
pkill -f "node.*next/dist/bin/next" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 0.3

# Install web/ deps if this is a fresh checkout. Idempotent if already done.
if [[ ! -d web/node_modules ]]; then
  echo "→ web/: installing deps (one-time)…"
  (cd web && pnpm install)
fi

# Launch detached. nohup keeps them alive if the parent shell closes.
nohup ./bin/shoplit-api >"${LOGS_DIR}/api.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "${PIDS_DIR}/api.pid"

nohup ./bin/shoplit-redirect >"${LOGS_DIR}/redirect.log" 2>&1 &
REDIRECT_PID=$!
echo "$REDIRECT_PID" > "${PIDS_DIR}/redirect.pid"

# Use pnpm's -C flag instead of a sh wrapper so the PID we track is pnpm's
# (which forwards signals to its child `next dev` on SIGTERM), not a transient
# sh process that would be orphaned by `kill $WEB_PID`.
nohup pnpm -C web dev >"${LOGS_DIR}/web.log" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" > "${PIDS_DIR}/web.pid"

# Wait up to N seconds for the service's HTTP endpoint to respond.
wait_for_health() {
  local name=$1 url=$2 pid=$3 logfile=$4 timeout=${5:-8}
  local deadline=$(( $(date +%s) + timeout ))
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
  echo "✗ shoplit-${name} did not respond at ${url} within ${timeout}s. last 20 lines:"
  tail -20 "$logfile"
  return 1
}

cleanup_on_fail() {
  kill "$API_PID" "$REDIRECT_PID" "$WEB_PID" 2>/dev/null || true
  rm -f "${PIDS_DIR}/api.pid" "${PIDS_DIR}/redirect.pid" "${PIDS_DIR}/web.pid"
}

if ! wait_for_health api http://localhost:8080/health "$API_PID" "${LOGS_DIR}/api.log"; then
  cleanup_on_fail
  exit 1
fi
if ! wait_for_health redirect http://localhost:8081/health "$REDIRECT_PID" "${LOGS_DIR}/redirect.log"; then
  cleanup_on_fail
  exit 1
fi
# Next.js dev compile on cold start can take 5–15s — give it 30s.
if ! wait_for_health web http://localhost:3000/ "$WEB_PID" "${LOGS_DIR}/web.log" 30; then
  cleanup_on_fail
  exit 1
fi

echo "✓ shoplit-api      → http://localhost:8080  (pid $API_PID,  logs: ${LOGS_DIR}/api.log)"
echo "✓ shoplit-redirect → http://localhost:8081  (pid $REDIRECT_PID, logs: ${LOGS_DIR}/redirect.log)"
echo "✓ shoplit-web      → http://localhost:3000  (pid $WEB_PID, logs: ${LOGS_DIR}/web.log)"
echo ""
echo "  make logs   # tail all service logs"
echo "  make down   # stop everything"
