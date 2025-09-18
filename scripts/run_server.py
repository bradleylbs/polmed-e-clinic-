#!/usr/bin/env python3
"""
PALMED Mobile Clinic ERP - Flask API Server
Run this script to start the Flask development server
"""

import os
import sys

# Ensure we can import the Flask app from scripts/app.py reliably
# Try adding the repository root and the scripts directory to sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
SCRIPTS_DIR = os.path.abspath(os.path.dirname(__file__))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

# Import the Flask app instance, preferring scripts.app
try:
    from scripts.app import app  # type: ignore
except Exception:
    # Fallback to top-level app if present
    from app import app  # type: ignore

def main():
    """Main entry point for the Flask application"""
    
    # Set environment variables if not already set
    if not os.environ.get('FLASK_ENV'):
        os.environ['FLASK_ENV'] = 'development'
    
    if not os.environ.get('FLASK_DEBUG'):
        os.environ['FLASK_DEBUG'] = 'True'
    
    # Print startup information
    print("=" * 60)
    print("PALMED Mobile Clinic ERP - Flask API Server")
    print("=" * 60)
    print(f"Environment: {os.environ.get('FLASK_ENV', 'development')}")
    print(f"Debug Mode: {os.environ.get('FLASK_DEBUG', 'True')}")
    print(f"Database: {os.environ.get('DB_NAME', 'palmed_clinic_erp')}")
    print(f"Host: {os.environ.get('FLASK_HOST', '0.0.0.0')}")
    print(f"Port: {os.environ.get('FLASK_PORT', '5000')}")
    print("=" * 60)
    print("\nAPI Endpoints:")
    print("- Authentication: /api/auth/login, /api/auth/register")
    print("- Patients: /api/patients")
    print("- Routes: /api/routes")
    print("- Inventory: /api/inventory/assets, /api/inventory/consumables")
    print("- Sync: /api/sync/upload, /api/sync/download")
    print("- Dashboard: /api/dashboard/stats")
    print("- Health: /api/health")
    print("=" * 60)
    print("\nStarting server...")
    
    try:
        # Run the Flask application
        app.run(
            debug=os.environ.get('FLASK_DEBUG', 'True').lower() == 'true',
            host=os.environ.get('FLASK_HOST', '0.0.0.0'),
            port=int(os.environ.get('FLASK_PORT', 5000))
        )
    except KeyboardInterrupt:
        print("\n\nServer stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\nError starting server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
