#!/usr/bin/env bash
# Startup script for Azure App Service (Linux) to run the Flask API via Gunicorn
# - Installs Python dependencies from scripts/requirements.txt
# - Starts Gunicorn binding to $PORT with configurable workers/threads

set -euo pipefail

echo "[startup] PALMED ERP backend startup initiated"
python --version || true
pip --version || true

# Install dependencies
if [ -f scripts/requirements.txt ]; then
  echo "[startup] Installing Python dependencies..."
  python -m pip install --upgrade pip
  pip install -r scripts/requirements.txt
else
  echo "[startup][warn] scripts/requirements.txt not found"
fi

# Defaults if not provided by App Service
PORT="${PORT:-8000}"
WORKERS="${WORKERS:-2}"
THREADS="${THREADS:-4}"
TIMEOUT="${TIMEOUT:-120}"
BIND="0.0.0.0:${PORT}"

# Ensure unbuffered output for better log streaming
export PYTHONUNBUFFERED=1

echo "[startup] Launching Gunicorn: bind=${BIND} workers=${WORKERS} threads=${THREADS} timeout=${TIMEOUT}"
exec gunicorn \
  --bind "${BIND}" \
  --workers "${WORKERS}" \
  --threads "${THREADS}" \
  --timeout "${TIMEOUT}" \
  scripts.app:app
