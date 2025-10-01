#!/bin/bash
set -e

echo "[startup] Starting PALMED Mobile Clinic ERP API..."

# Ensure virtual environment exists (optional but recommended)
if [ ! -d "antenv" ]; then
  echo "[startup] Creating virtual environment..."
  python -m venv antenv
fi
source antenv/bin/activate

# Install dependencies from the correct requirements.txt
if [ -f requirements.txt ]; then
  echo "[startup] Installing Python dependencies..."
  python -m pip install --upgrade pip
  pip install -r requirements.txt
else
  echo "[startup][WARN] requirements.txt not found!"
fi

# Gunicorn settings
BIND=${BIND:-0.0.0.0:8000}
WORKERS=${WORKERS:-4}
THREADS=${THREADS:-2}
TIMEOUT=${TIMEOUT:-600}

echo "[startup] Launching Gunicorn on ${BIND} with ${WORKERS} workers, ${THREADS} threads, ${TIMEOUT}s timeout"

# Start Gunicorn pointing directly to app.py
exec gunicorn \
  --bind "${BIND}" \
  --workers "${WORKERS}" \
  --threads "${THREADS}" \
  --timeout "${TIMEOUT}" \
  app:app
