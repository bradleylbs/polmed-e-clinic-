"""
WSGI entrypoint for Azure App Service (Linux).

Keeps the startup command stable (gunicorn run_server:app) regardless of
whether we deploy via pipeline ZIP (with scripts/ packaged as site root) or
via local git push (repo root as site root).
"""

try:
    # Preferred: import Flask app from scripts package
    from scripts.app import app  # type: ignore
except Exception:
    # Fallback: if scripts/ is the site root after ZIP deploy
    from app import app  # type: ignore
