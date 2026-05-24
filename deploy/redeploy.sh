#!/usr/bin/env bash
# One-command redeploy to the EC2 host: pull latest main, rebuild changed
# images, recreate containers. Run from your laptop.
#
#   ./deploy/redeploy.sh                # redeploy everything
#   ./deploy/redeploy.sh shoplit-web    # rebuild just one service (faster)
#
# Host/key default to the current box; override via env if they change:
#   SHOPLIT_DEPLOY_HOST=ubuntu@1.2.3.4 SHOPLIT_DEPLOY_KEY=~/k.pem ./deploy/redeploy.sh
set -euo pipefail

HOST="${SHOPLIT_DEPLOY_HOST:-ubuntu@13.239.93.134}"
KEY="${SHOPLIT_DEPLOY_KEY:-$HOME/Downloads/shop-lit.pem}"
SERVICE="${1:-}"
COMPOSE="docker compose -f deploy/compose.prod.yaml --env-file deploy/.env"

echo "→ Deploying to $HOST ${SERVICE:+(service: $SERVICE)}"
ssh -i "$KEY" -o ServerAliveInterval=30 -o ServerAliveCountMax=10 "$HOST" "
  set -e
  cd shoplit
  echo '→ git pull'
  git pull --ff-only
  echo '→ build + up'
  sudo $COMPOSE up -d --build $SERVICE
  echo '→ status'
  sudo $COMPOSE ps --format '{{.Service}}: {{.Status}}'
"
echo "✓ Done — https://shoplit.in"
