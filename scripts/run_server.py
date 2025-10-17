#!/usr/bin/env python3
"""
PALMED Mobile Clinic ERP - Flask API Server
Run this script locally for development
"""

import os
import sys

# Make sure project root is in sys.path
REPO_ROOT = os.path.abspath(os.path.dirname(__file__))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

# Import Flask app from app.py in the same folder
from app import app  # type: ignore


def main():
    """Main entry point for local Flask dev server"""

    # Default environment vars if not set
    os.environ.setdefault("FLASK_ENV", "development")
    os.environ.setdefault("FLASK_DEBUG", "True")
    os.environ.setdefault("FLASK_HOST", "0.0.0.0")
    os.environ.setdefault("FLASK_PORT", "5000")

    print("=" * 60)
    print("PALMED Mobile Clinic ERP - Flask API Server")
    print("=" * 60)
    print(f"Environment: {os.environ['FLASK_ENV']}")
    print(f"Debug Mode: {os.environ['FLASK_DEBUG']}")
    print(f"Database: {os.environ.get('DB_NAME', 'palmed_clinic_erp')}")
    print(f"Host: {os.environ['FLASK_HOST']}")
    print(f"Port: {os.environ['FLASK_PORT']}")
    print("=" * 60)
    print("API Endpoints:")
    print("- Authentication: /api/auth/login, /api/auth/register")
    print("- Patients: /api/patients")
    print("- Routes: /api/routes")
    print("- Inventory: /api/inventory/assets, /api/inventory/consumables")
    print("- Sync: /api/sync/upload, /api/sync/download")
    print("- Dashboard: /api/dashboard/stats")
    print("- Health: /api/health")
    print("=" * 60)
    print("Starting development server...\n")

    try:
        app.run(
            debug=os.environ["FLASK_DEBUG"].lower() == "true",
            host=os.environ["FLASK_HOST"],
            port=int(os.environ["FLASK_PORT"]),
        )
    except KeyboardInterrupt:
        print("\n\nServer stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\nError starting server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
