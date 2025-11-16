# Azure Deployment Guide

This document walks through deploying the PALMED Mobile Clinic ERP stack (Next.js frontend + Flask backend + MySQL) into Azure.

## Prerequisites

- Azure subscription with permissions to create and manage resources.
- Azure DevOps (or GitHub) service connection that can deploy to the target subscription.
- Existing Azure Database for MySQL Flexible Server (or provision one before the backend deployment).
- `app-polmed-backend` Azure App Service (Linux, Python 3.11) and Static Web App resource (for the frontend).
- Secrets (database credentials, JWT secret) available for configuration.

## 1. Backend (Flask API) on Azure App Service

1. **Create / confirm resources**
   - App Service Plan (Linux) sized appropriately for your load.
   - Web App named `app-polmed-backend` targeting Python 3.11 runtime.
   - Azure Database for MySQL Flexible Server with firewall rules allowing the App Service outbound IPs.

2. **Configure application settings** (Azure Portal → Web App → *Settings* → *Configuration*):

   | Setting | Value |
   | ------- | ----- |
   | `DB_HOST` | `your-mysql-host.mysql.database.azure.com` |
   | `DB_NAME` | `palmed_clinic_erp` |
   | `DB_USER` | `dbadmin@your-mysql-host` |
   | `DB_PASSWORD` | MySQL password |
   | `DB_PORT` | `3306` |
   | `SECRET_KEY` | Long random string |
   | `AZURE_STORAGE_CONNECTION_STRING` | Connection string for the Azure Storage account |
   | `AZURE_STORAGE_CONTAINER_NAME` | Name of the blob container for document uploads |
   | `CORS_ALLOWED_ORIGINS` | `https://<static-web-app>.azurestaticapps.net` (comma‑separate additional origins) |
   | `DB_SSL_CA` | Path to CA cert if enforcing SSL (optional) |
   | `JWT_ISSUER` / `JWT_AUDIENCE` | Values validated on every staff token (example: `palmed-clinic-api` / `palmed-clinic-staff`) |
   | `PATIENT_JWT_ISSUER` / `PATIENT_JWT_AUDIENCE` | Separate issuer/audience for portal tokens |
   | `JWT_TTL_MINUTES` / `PATIENT_JWT_TTL_MINUTES` | Control token lifetimes (default 60 / 720) |
   | `RATE_LIMIT_STORAGE_URI` | Persistent limiter backend (e.g., `redis://:<key>@<cache-name>.redis.cache.windows.net:6380/0?ssl=true`) |
   | `AUTH_RATE_LIMIT` / `PORTAL_AUTH_RATE_LIMIT` | Tune login throttling per environment (e.g., `10 per minute`) |

   > Tip: keep secrets in Azure Key Vault and reference them via `@Microsoft.KeyVault(...)` if desired.

3. **Update the Azure Pipeline**
   - Open `azure-pipelines.yml` and set `webAppResourceGroup` to your App Service resource group name **or** add a pipeline variable with that value.
   - Ensure `requirements.txt` inside `scripts/` includes every backend dependency and stays pinned.
   - Commit and push to `master` to trigger CI/CD:
     - *Build* stage sets up Python, installs dependencies, and zips the backend.
     - *Deploy* stage forces `SCM_DO_BUILD_DURING_DEPLOYMENT=true` and deploys the zip to the Web App.

4. **Seed or migrate the database**
   - Copy the environment variables locally (or inject via Azure Cloud Shell) and run:
     ```powershell
     cd scripts
     python create_test_users.py
     ```
   - Run migration scripts if needed before exposing the API.

5. **Smoke test the API**
   ```powershell
   Invoke-RestMethod -Method Get -Uri "https://app-polmed-backend.azurewebsites.net/api/health"
   ```
   ```powershell
   Invoke-RestMethod -Method Post -Uri "https://app-polmed-backend.azurewebsites.net/api/auth/login" -ContentType "application/json" -Body (@{ email = "admin.test@palmed.co.za"; password = "admin123" } | ConvertTo-Json)
   ```

6. **Monitoring**
   - Enable Application Insights for deeper logging/metrics.
   - Configure log streaming and diagnostic settings to send logs to a storage account or Log Analytics workspace.

## 2. Frontend (Next.js) on Azure Static Web Apps

1. **Resource creation**
   - Create a Static Web App (Standard plan if you need SSR). During setup, select the `master` branch in GitHub and set:
     - *App location*: `/`
     - *Api location*: *(leave blank)*
     - *Output location*: `.next`

2. **Workflow adjustments**
   - The generated GitHub Actions workflow should install Node 18/20, install dependencies (`npm install` or `pnpm install`), run `npm run build`, and upload artifacts.
   - If using PNPM, inject `pnpm/action-setup@v4` before install.

3. **Frontend environment variables**
   - In the Static Web App portal → *Configuration*, add:
   - `NEXT_PUBLIC_API_BASE_URL = https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api`
   - Redeploy or trigger the workflow after updating settings.

4. **API routing**
   - `public/staticwebapp.config.json` rewrites `/api/*` to `https://app-polmed-backend.azurewebsites.net/api/*`. Update this file if the backend hostname changes.

5. **Validation**
   - Browse to the Static Web App URL and perform login flows.
   - Use browser DevTools to confirm API calls hit the `azurewebsites.net` backend and receive `200` responses.

## 3. Post-deployment checklist

- [ ] Add both frontend and backend hosts to CORS origins.
- [ ] Configure custom domains and certificates as needed.
- [ ] Set up alerts on App Service (CPU, memory, errors) and MySQL (connections, storage).
- [ ] Document rotation process for secrets and database credentials.
- [ ] Establish a staging environment (App Service deployment slot + Static Web App staging) for pre-production validation.

## 4. Troubleshooting

| Issue | Resolution |
| ----- | ---------- |
| `401 Invalid email or password` | Ensure `create_test_users.py` ran against the production database and that hashes match. |
| API unreachable from frontend | Verify `CORS_ALLOWED_ORIGINS` and Static Web App configuration; confirm backend is publicly accessible. |
| Pipeline fails to find resource group | Set the `webAppResourceGroup` variable in `azure-pipelines.yml` or as a pipeline variable. |
| MySQL connection timeout | Add App Service outbound IPs to MySQL firewall; ensure VNet integration if using private endpoints. |

With both resources in place and settings applied, your production deployment will mirror the working local setup.
