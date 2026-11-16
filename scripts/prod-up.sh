#!/usr/bin/env bash
# Bring up comGpt in production mode: Caddy auto-HTTPS + hardened compose override.
# Requires a filled-in .env (copy from .env.production.example first).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.production.example to .env and fill it in first." >&2
  exit 1
fi

exec docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build "$@"