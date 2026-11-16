#!/usr/bin/env bash
# comGpt — Oracle Cloud Free (ARM) standalone bootstrap. NO Coolify required.
#
# Run from the repo root on a fresh Ubuntu 24.04/22.04 instance (arm64 or amd64):
#   git clone <your-repo-url> && cd SMS
#   bash scripts/oracle-bootstrap.sh
#
# What it does, in order:
#   1. Clears Oracle's default iptables REJECT rules (the cloud Security List is
#      your real firewall — you must ALSO open TCP 80/443 there).
#   2. Installs Docker Engine + the Compose plugin (multi-arch; arm64 verified).
#   3. Generates a protected .env with random secrets and a free nip.io hostname
#      (no owned domain needed; Let's Encrypt issues certs for *.nip.io).
#   4. Builds + starts the stack: Caddy auto-HTTPS on 80/443, all other ports
#      internal-only, demo data ON (a seeded login is printed at the end).
#
# Re-running is safe: an existing .env and Docker install are reused.
# Override any prompt by exporting it first, e.g.:
#   PUBLIC_IP=1.2.3.4 DOMAIN=app.example.com WHATSAPP_APP_SECRET=xxx bash scripts/oracle-bootstrap.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

for f in docker-compose.yml docker-compose.prod.yml infrastructure/caddy/Caddyfile; do
  [ -f "$f" ] || { echo "Missing $f — run this from the comGpt repo root." >&2; exit 1; }
done

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || { echo "sudo is required (or run as root)." >&2; exit 1; }
  SUDO="sudo"
fi

echo "==> Architecture: $(uname -m)"

# --- 1. Firewall + Docker ---------------------------------------------------
# Only flush on a fresh box: flushing after Docker is up would wipe its chains.
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Clearing Oracle's default iptables REJECT rules..."
  $SUDO iptables -P INPUT ACCEPT   || true
  $SUDO iptables -P FORWARD ACCEPT || true
  $SUDO iptables -P OUTPUT ACCEPT  || true
  $SUDO iptables -F || true
  $SUDO iptables -X || true
  if command -v netfilter-persistent >/dev/null 2>&1; then
    $SUDO netfilter-persistent save || true
  fi

  echo "==> Installing Docker Engine + Compose plugin..."
  if ! command -v curl >/dev/null 2>&1; then
    $SUDO apt-get update -y
    $SUDO apt-get install -y curl
  fi
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker
else
  echo "==> Docker already installed; reusing it."
fi

if ! $SUDO docker compose version >/dev/null 2>&1; then
  echo "==> Installing Docker Compose plugin..."
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker-compose-plugin
fi

echo "==> REMINDER: open TCP 80 and 443 (and UDP 443 for HTTP/3) in the Oracle"
echo "    VCN Security List / NSG. The cloud firewall blocks them by default."

# --- 2. Generate .env (skipped if one already exists) -----------------------
if [ -f .env ]; then
  echo "==> .env already exists; reusing it (delete it to regenerate)."
  DOMAIN="$(grep -E '^DOMAIN=' .env | head -n1 | cut -d= -f2-)"
  DOMAIN="${DOMAIN:-localhost}"
else
  PUBLIC_IP="${PUBLIC_IP:-$(curl -fsS --max-time 10 https://api.ipify.org || true)}"
  if [ -z "$PUBLIC_IP" ]; then
    read -r -p "Enter this server's PUBLIC IPv4 address: " PUBLIC_IP
  fi
  [ -n "$PUBLIC_IP" ] || { echo "A public IP is required." >&2; exit 1; }

  # nip.io resolves <name>.<ip>.nip.io to <ip>; Let's Encrypt trusts it (250k cert
  # limit). Replace DOMAIN with a real owned domain later for a branded URL.
  DOMAIN="${DOMAIN:-comgpt.${PUBLIC_IP}.nip.io}"
  read -r -p "Public hostname [$DOMAIN]: " input_domain
  DOMAIN="${input_domain:-$DOMAIN}"

  ACME_EMAIL="${ACME_EMAIL:-}"
  if [ -z "$ACME_EMAIL" ]; then
    read -r -p "Email for Let's Encrypt notices (optional) [admin@$DOMAIN]: " ACME_EMAIL
    ACME_EMAIL="${ACME_EMAIL:-admin@$DOMAIN}"
  fi

  WHATSAPP_ACCESS_TOKEN="${WHATSAPP_ACCESS_TOKEN:-}"
  WHATSAPP_APP_SECRET="${WHATSAPP_APP_SECRET:-}"
  if [ -z "$WHATSAPP_ACCESS_TOKEN" ]; then
    read -r -p "Meta WhatsApp ACCESS_TOKEN (System User token): " WHATSAPP_ACCESS_TOKEN
  fi
  if [ -z "$WHATSAPP_APP_SECRET" ]; then
    read -r -p "Meta WhatsApp APP_SECRET: " WHATSAPP_APP_SECRET
  fi
  # The prod override fails fast if APP_SECRET/VERIFY_TOKEN are empty (webhook
  # signature validation). VERIFY_TOKEN is generated below; APP_SECRET is required.
  [ -n "$WHATSAPP_APP_SECRET" ] || {
    echo "WHATSAPP_APP_SECRET is required for production. Re-run and provide it," >&2
    echo "or export WHATSAPP_APP_SECRET before running this script." >&2
    exit 1
  }
  if [ -z "$WHATSAPP_ACCESS_TOKEN" ]; then
    echo "==> WARNING: no WHATSAPP_ACCESS_TOKEN — sends will fail until you add it to .env."
  fi

  echo "==> Generating .env with random secrets..."
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  RABBITMQ_PASSWORD="$(openssl rand -hex 24)"
  OMNIFLOW_JWT_SECRET="$(openssl rand -base64 48)"
  OMNIFLOW_ENCRYPTION_KEY="$(openssl rand -base64 48)"
  WHATSAPP_VERIFY_TOKEN="$(openssl rand -hex 16)"
  # Random demo password (hex avoids .env quoting issues); override by exporting it.
  OMNIFLOW_DEMO_PASSWORD="${OMNIFLOW_DEMO_PASSWORD:-$(openssl rand -hex 16)}"

  umask 077
  cat > .env <<EOF
# Generated by scripts/oracle-bootstrap.sh — NEVER commit this file (chmod 600).
DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL
FRONTEND_URL=https://$DOMAIN
NEXT_PUBLIC_APP_NAME=comGpt

POSTGRES_DB=omniflow
POSTGRES_USER=omniflow
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

RABBITMQ_USERNAME=omniflow
RABBITMQ_PASSWORD=$RABBITMQ_PASSWORD

OMNIFLOW_JWT_SECRET=$OMNIFLOW_JWT_SECRET
# SET ONCE, KEEP STABLE, BACK IT UP. Changing it makes stored credentials undecryptable.
OMNIFLOW_ENCRYPTION_KEY=$OMNIFLOW_ENCRYPTION_KEY
# Demo workspace seeded on first boot (idempotent). Disable before real clients.
OMNIFLOW_DEMO_DATA=true
OMNIFLOW_DEMO_EMAIL=owner@omniflow.local
OMNIFLOW_DEMO_PASSWORD=$OMNIFLOW_DEMO_PASSWORD
OMNIFLOW_DEMO_ORG=Acme Retail

# Email deferred: fill these when your SMTP relay (e.g. Postal) is ready.
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_STARTTLS=true
SMTP_FROM=noreply@$DOMAIN

WHATSAPP_ACCESS_TOKEN=$WHATSAPP_ACCESS_TOKEN
WHATSAPP_APP_SECRET=$WHATSAPP_APP_SECRET
WHATSAPP_VERIFY_TOKEN=$WHATSAPP_VERIFY_TOKEN
# Leave blank so each workspace's config.phoneNumberId wins.
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v21.0

OMNIFLOW_RATE_EMAIL_PER_MIN=600
OMNIFLOW_RATE_WHATSAPP_PER_MIN=300
OMNIFLOW_RATE_SMS_PER_MIN=300

IMPORT_STAGING_DIR=/app/data/imports
IMPORT_MAX_CHUNK_MB=64
IMPORT_MAX_FILE_BYTES=0
EOF
  chmod 600 .env
  echo "==> Wrote .env (chmod 600). BACK UP OMNIFLOW_ENCRYPTION_KEY now."
fi

# --- 3. Build + start -------------------------------------------------------
echo "==> Building and starting comGpt (first build on 2 ARM cores can take 10-20 min)..."
$SUDO docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Read the demo login from .env (works whether .env was just created or reused).
DEMO_DATA="$(grep -E '^OMNIFLOW_DEMO_DATA=' .env | head -n1 | cut -d= -f2- || true)"
DEMO_EMAIL="$(grep -E '^OMNIFLOW_DEMO_EMAIL=' .env | head -n1 | cut -d= -f2- || true)"
DEMO_PASSWORD="$(grep -E '^OMNIFLOW_DEMO_PASSWORD=' .env | head -n1 | cut -d= -f2- || true)"
DEMO_ORG="$(grep -E '^OMNIFLOW_DEMO_ORG=' .env | head -n1 | cut -d= -f2- || true)"

cat <<EOF

==> Done. Caddy is obtaining a Let's Encrypt cert for $DOMAIN (needs 80/443 open).

    Frontend:         https://$DOMAIN
    WhatsApp webhook: https://$DOMAIN/api/v1/webhooks/whatsapp

Next steps:
  1. Wait ~1-2 min for TLS, then open https://$DOMAIN and sign in with the demo
     login below (a sample workspace is seeded on first boot).
  2. Meta App Dashboard -> WhatsApp -> Configuration: set the callback URL to the
     webhook above, the verify token to WHATSAPP_VERIFY_TOKEN in .env, and
     subscribe to the 'messages' field.
  3. In your workspace -> Integrations, add WhatsApp (Meta Cloud API) with blank
     credentials and config.phoneNumberId = your Meta number ID (+ templateName
     for approved marketing templates).

  Logs:  $SUDO docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
  Stop:  $SUDO docker compose -f docker-compose.yml -f docker-compose.prod.yml down
EOF

if [ "${DEMO_DATA:-false}" = "true" ]; then
  cat <<EOF

==> Demo login (seeded workspace '${DEMO_ORG:-Acme Retail}'):
      Email:    ${DEMO_EMAIL:-owner@omniflow.local}
      Password: ${DEMO_PASSWORD:-OmniFlow123!}
    Saved in .env (OMNIFLOW_DEMO_*). The seed is idempotent — it only runs once.
    SECURITY: this is a public app. Before onboarding real clients, set
    OMNIFLOW_DEMO_DATA=false in .env and recreate, or change the demo password.
EOF
fi