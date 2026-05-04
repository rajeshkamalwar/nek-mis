#!/usr/bin/env bash
# ============================================================
# NEK-MIS  —  Hostinger VPS Deploy Script
# Ubuntu 24.04 + CloudPanel
# Usage:  bash deploy.sh
# ============================================================
set -euo pipefail

APP_DIR="/opt/nek-mis"
GITHUB_REPO="https://github.com/rajeshkamalwar/nek-mis.git"
BACKEND_PORT=8021
DB_NAME="zoho_mapping_studio"
DB_USER="nek_mis"
# Change this password before running!
DB_PASS="${DB_PASS:-ChangeMe_StrongPass_123}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }

# ── 1. System packages ────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq
apt-get install -y -qq \
  git curl wget build-essential \
  python3 python3-pip python3-venv python3-dev \
  postgresql postgresql-contrib \
  redis-server \
  nginx \
  libpq-dev

# ── 2. Node 20 (for building the frontend) ────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  info "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
info "Node $(node -v) / npm $(npm -v)"

# ── 3. PostgreSQL database + user ─────────────────────────────────────────────
info "Setting up PostgreSQL..."
systemctl enable --now postgresql

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

# ── 4. Redis ──────────────────────────────────────────────────────────────────
info "Enabling Redis..."
systemctl enable --now redis-server

# ── 5. Clone / pull repo ─────────────────────────────────────────────────────
if [ -d "${APP_DIR}/.git" ]; then
  info "Pulling latest code..."
  git -C "${APP_DIR}" pull
else
  info "Cloning repository..."
  git clone "${GITHUB_REPO}" "${APP_DIR}"
fi

# ── 6. Backend Python venv ────────────────────────────────────────────────────
info "Setting up Python virtual environment..."
python3 -m venv "${APP_DIR}/.venv"
"${APP_DIR}/.venv/bin/pip" install --quiet --upgrade pip
"${APP_DIR}/.venv/bin/pip" install --quiet -r "${APP_DIR}/backend/requirements.txt"

# ── 7. Write backend .env (only if it doesn't exist) ─────────────────────────
ENV_FILE="${APP_DIR}/backend/.env"
if [ ! -f "${ENV_FILE}" ]; then
  info "Writing backend/.env  (edit this file to add Zoho credentials)..."
  cat > "${ENV_FILE}" <<EOF
DATABASE_URL=postgresql+psycopg2://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
REDIS_URL=redis://localhost:6379/0

ZOHO_API_BASE=https://www.zohoapis.com/books/v3
ZOHO_OAUTH_URL=https://accounts.zoho.com/oauth/v2/token
ZOHO_ACCESS_TOKEN=
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORGANIZATION_ID=
ZOHO_DEFAULT_CONTACT_ID=
ZOHO_CLEARING_ACCOUNT_ID=
EOF
  warn "IMPORTANT: Edit ${ENV_FILE} and fill in your Zoho credentials!"
else
  info "backend/.env already exists — skipping."
fi

# ── 8. Run Alembic migrations ────────────────────────────────────────────────
info "Running database migrations..."
cd "${APP_DIR}/backend"
"${APP_DIR}/.venv/bin/alembic" upgrade head

# ── 9. Build frontend ─────────────────────────────────────────────────────────
info "Installing frontend dependencies..."
cd "${APP_DIR}/frontend"

# Point the frontend at the same origin (Nginx will proxy /api)
cat > "${APP_DIR}/frontend/.env.local" <<EOF
VITE_API_URL=
EOF

npm ci --silent
npm run build

# ── 10. systemd: backend (uvicorn) ────────────────────────────────────────────
info "Installing systemd service: nek-mis-backend..."
cat > /etc/systemd/system/nek-mis-backend.service <<EOF
[Unit]
Description=NEK-MIS FastAPI Backend
After=network.target postgresql.service redis.service

[Service]
User=root
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT} --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ── 11. systemd: Celery worker ────────────────────────────────────────────────
info "Installing systemd service: nek-mis-celery..."
cat > /etc/systemd/system/nek-mis-celery.service <<EOF
[Unit]
Description=NEK-MIS Celery Worker
After=network.target redis.service

[Service]
User=root
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/.venv/bin/celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now nek-mis-backend
systemctl enable --now nek-mis-celery

# ── 12. Nginx config ──────────────────────────────────────────────────────────
info "Writing Nginx config..."
cat > /etc/nginx/sites-available/nek-mis <<EOF
server {
    listen 80;
    server_name _;          # catches the bare IP; add your domain here later

    # Serve the built React frontend
    root ${APP_DIR}/frontend/dist;
    index index.html;

    # API  →  FastAPI backend
    location /api/ {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }

    # SPA fallback (React Router)
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Disable default site, enable ours
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/nek-mis /etc/nginx/sites-enabled/nek-mis

nginx -t && systemctl reload nginx

# ── 13. Firewall ──────────────────────────────────────────────────────────────
info "Opening firewall ports 22, 80, 443..."
if command -v ufw &>/dev/null; then
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  ufw --force enable
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  NEK-MIS deployed successfully!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  App URL  :  http://195.35.23.30"
echo "  API docs :  http://195.35.23.30/api/docs"
echo ""
echo "  Backend service : systemctl status nek-mis-backend"
echo "  Celery  service : systemctl status nek-mis-celery"
echo ""
warn "Next step: edit ${ENV_FILE} with your Zoho credentials, then:"
warn "  systemctl restart nek-mis-backend nek-mis-celery"
echo ""
