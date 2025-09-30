# Tests for Flask backend

How to run locally (Windows PowerShell):

1. cd scripts
2. python -m venv .venv
3. .\.venv\Scripts\Activate.ps1
4. pip install -r requirements.txt
5. pip install -r requirements-dev.txt
6. pytest -q --cov=app --cov-report=term-missing

Notes:
- Tests use Flask's test_client and do not require a database.
- CI sets SECRET_KEY for deterministic JWT and runs from the scripts folder.
