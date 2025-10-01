# POLMED Mobile Clinic ERP

## Overview
A full-stack solution for mobile clinic management, featuring a Next.js frontend and a Flask (Python) backend with a MySQL database.

## Project Structure
- **Frontend:** Next.js (TypeScript) in `app/`, `components/`, `lib/`, etc.
- **Backend:** Flask API in `scripts/app.py` and related Python files.
- **Database:** MySQL, schema and seed scripts in `scripts/`.

## Prerequisites
- Node.js (v18+ recommended)
- Python 3.9+
- MySQL Server

## Setup Instructions

### 1. Clone the repository
```sh
git clone <your-repo-url>
cd POLMEDERP
```

### 2. Frontend (Next.js)
- Install dependencies:
  ```sh
  npm install
  ```
- Build static site:
  ```sh
  npm run build
  ```
- The static site will be generated in the `out/` directory.

#### Environment Variables
Create a `.env` file in the root with:
```
NEXT_PUBLIC_API_BASE_URL=https://<your-backend-api-url>/api
```

### 3. Backend (Flask)
- Install dependencies:
  ```sh
  pip install -r scripts/requirements.txt
  ```
- Set environment variables (example for development):
  ```sh
  set DB_HOST=localhost
  set DB_NAME=palmed_clinic_erp
  set DB_USER=root
  set DB_PASSWORD=yourpassword
  ```
- Run the server:
  ```sh
  python scripts/run_server.py
  ```

### 4. Database
- Create the database and tables:
  ```sh
  mysql -u root -p < scripts/01_create_database_schema.sql
  mysql -u root -p < scripts/05_insert_initial_data.sql
  # ...run other scripts as needed
  ```

## Deployment

### Azure Static Web Apps (Frontend)
- Deploy via Azure Static Web Apps GitHub Action (SSR supported on Standard plan).
- Set `NEXT_PUBLIC_API_BASE_URL` in the Azure portal to your backend API endpoint (include `/api`). For the current production backend use `https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api`.

### Azure App Service (Backend)
- Deploy the Flask app in `scripts/` (pipeline provided in `azure-pipelines.yml`).
- Set environment variables for DB connection and secrets in Azure portal.

> See `docs/azure-deployment.md` for the full end-to-end Azure walkthrough.

## Notes
- All API calls from the frontend use `NEXT_PUBLIC_API_URL`.
- For local development, the default API URL is `http://localhost:5000/api`.
- Update environment variables as needed for your environment.

---

For more details, see the code and comments in each folder.
