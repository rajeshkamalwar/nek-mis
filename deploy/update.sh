#!/usr/bin/env bash
# ============================================================
# NEK-MIS  —  Update Script
# Run on VPS: bash /opt/nek-mis/deploy/update.sh
# Or remotely: ssh root@195.35.23.30 "bash /opt/nek-mis/deploy/update.sh"
# ============================================================
set -euo pipefail

APP_DIR="/opt/nek-mis"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[+]${NC} $*"; }

info "Pulling latest code from GitHub..."
git -C "${APP_DIR}" pull

info "Installing any new Python dependencies..."
"${APP_DIR}/.venv/bin/pip" install --quiet -r "${APP_DIR}/backend/requirements.txt"

info "Running database migrations..."
cd "${APP_DIR}/backend"
"${APP_DIR}/.venv/bin/alembic" upgrade head

info "Installing any new frontend dependencies..."
cd "${APP_DIR}/frontend"
npm ci --silent

info "Building frontend..."
npm run build

info "Restarting services..."
systemctl restart nek-mis-backend nek-mis-celery

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  NEK-MIS updated successfully!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  Live at: https://nekmis.online"
echo ""
