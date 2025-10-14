# POLMED Mobile Clinic ERP – Implemented Functionality

## Platform Overview
- Full-stack solution with a Next.js 14 frontend (`app/`, `components/`, `lib/`) and Flask REST API (`scripts/app.py`).
- MySQL schema managed through versioned DDL and seed scripts in `scripts/*.sql`, plus helper scripts for data population and test user creation.
- Deployments target Azure Static Web Apps for the frontend and Azure App Service for the backend (pipelines in `azure-*.yml`, guidance in `docs/azure-deployment.md`).
- Offline-first runtime: IndexedDB storage and sync queue via `lib/offline-manager.ts`, surfaced to staff through `components/offline/sync-manager.tsx`.
- Shared design system based on shadcn/ui components, Tailwind, and Lucide icons (`components/ui/*`, `app/globals.css`).

## Implemented Functional Areas

### Public & Patient-Facing Experience
- Marketing and education site at `/landing` with schedule highlights, outreach narrative, and CTA links to portals.
- Patient portal (`app/patient-portal/page.tsx`) with registration, login, and seven-day session persistence; email verification links and password reset flows handled through `/patient-portal/*` endpoints.
- Dashboard (`components/patient-portal/patient-portal-dashboard.tsx`) summarising appointments, recent visits, chronic conditions, allergies, medications, and notifications.
- Self-service booking (`components/patient-portal/patient-appointment-booking.tsx`) that consumes `patient-portal/appointments` APIs for slot discovery, booking, and cancellation.
- Patient preferences, health record drill-down, document retrieval, feedback capture, and notification read tracking managed through `lib/patient-portal-service.ts` endpoints.
- POLMED membership and medical aid validation endpoints guard registration and booking flows.

### Staff Operations Workspace
- Role-based authentication (`components/auth/login-form.tsx`, `/api/auth/login`) with JWT issuance, approval checks, and province restrictions.
- Persistent staff sessions stored in sessionStorage with expiry and renewal logic in `app/staff/page.tsx`.
- Navigation shell (`components/layout/app-shell.tsx`) broadcasts in-app route changes, handles connection banners, and centralises toast messaging.
- Role dashboards (`components/dashboard/role-dashboard.tsx`) show live metrics (patients served, bookings, vitals, referrals), tasks, activity feeds, and stock or maintenance alerts using `/api/dashboard` data.
- Sync Manager surfaces offline status, pending queue length, and manual sync controls for field teams.

### Patient Management & Clinical Workflow
- Patient directory (`components/patients/patient-list.tsx`) with multi-field search, POLMED membership badges, workflow state filters, and offline cache fallback.
- Detailed registration form (`components/patients/patient-registration.tsx`) captures demographics, emergency contacts, chronic conditions, allergies, and medication notes, respecting validation schemas in `lib/security-utils.ts`.
- Multi-stage clinical workflow (`components/patients/clinical-workflow.tsx`) guiding nursing, doctor, social worker, and closure steps; includes vitals capture, smart ICD-10 search (`apiService.searchICD10`), auto-suggestions, medication plans, referrals, and counselling notes.
- Referral management modal with internal/external routing, follow-up tracking, and backend persistence under `/api/referrals`.
- Visit closure endpoint (`/api/visits/<id>/close`) finalises episodes, queues POPIA-compliant email notifications, and writes Medscheme sync logs.

### Outreach Planning & Appointment Management
- Route planner (`components/routes/route-planner.tsx`) for outreach events: configure provinces, venue types, capacities, and time slots; queues creations while offline and syncs once reconnected.
- Route catalogue (`components/routes/route-list.tsx`) lists active, draft, and archived campaigns with filters, publication workflow, and analytics.
- Appointment booking console (`components/routes/appointment-booking.tsx`) links patients to route slots, prevents double-booking, and exposes attendance dashboards.
- Backend `/api/routes`, `/api/appointments`, and related endpoints manage schedules, slot availability, booking confirmations, and cancellation handling for both staff and patients.

### Inventory & Asset Control
- Inventory dashboard (`components/inventory/inventory-dashboard.tsx`) aggregates asset portfolios, consumable counts, expiring stock, maintenance alerts, and total inventory value.
- Asset management module (`components/inventory/asset-management.tsx`) handles categories, procurement details, valuation, depreciation, and maintenance scheduling, backed by `/api/inventory/assets` endpoints.
- Consumables management (`components/inventory/consumables-management.tsx`) supports suppliers, batches, stock receipts, reorder thresholds, and wastage tracking with `/api/inventory/consumables` services.
- Alerts engine produces low stock, expiry, and maintenance warnings consumed by dashboards and offline notifications.

### Administration, Security & Compliance
- User management console (`components/admin/user-management.tsx`) for onboarding, role assignment, approvals (e.g., doctors require MP numbers), activation toggles, and geographic restrictions.
- `scripts/app.py` enforces JWT auth, role-based decorators, rate limiting, audit logging, and tightened CORS origin lists.
- Shared security helpers (`lib/security-utils.ts`) provide zod validation, bcrypt hashing, rate-limit tracking, token generation, and audit log scaffolding.
- POPIA-aware visit closure logic ensures reports route to beneficiaries over 18 directly while queuing guardian delivery for minors (`visit_closure_notifications` table).
- Chronic disease program endpoints (`/api/chronic-disease/*`) enrol patients, manage care plans, and automatically raise Medscheme alerts for additional support.
- Medscheme integration groundwork: sync logs (`medscheme_sync_log`), chronic disease alerts, and `/api/medscheme/sync` placeholder for upstream API; actual transport is pending but events are already logged and queued.

### Offline & Sync Architecture
- IndexedDB stores (`patients`, `routes`, `inventory`, `appointments`, `syncQueue`) automatically created in `offlineManager.init()` for resilient field operations.
- Mutating API calls fall back to queued `offlineManager.queueOperation` entries when `navigator.onLine` is false; queues survive reloads via persisted `syncQueue` store.
- Manual and automatic syncing hits `/api/sync/pending`, carrying device identifiers and pending records for server reconciliation.
- UI feedback includes online/offline banners, pending counts, and disabled actions when syncing is not permitted.

### Notifications & Reporting
- Visit closure notifications, patient portal messages, and chronic program alerts are stored server-side for auditability and eventual delivery.
- Patient notifications (`/patient-portal/notifications`) and document download services offer transparent access to historical communications.
- Dashboard recent activity feed surfaces patient registrations, appointments, inventory changes, and route updates for operational oversight.

## Data & Infrastructure Assets
- SQL reference packs (`scripts/*.sql`) cover patients, visits, clinical notes, ICD-10 catalogues, inventory assets, consumables, routes, appointments, audit logs, chronic disease program, Medscheme sync, and notification tables.
- `scripts/config.py` centralises database credentials and runtime configuration; `scripts/run_server.py` wraps Flask app bootstrap with environment loading.
- `scripts/create_test_users.py` seeds staff accounts per role for staging and manual QA.
- Static assets (`public/`) include manifest metadata, branding, and Static Web App configuration for route rewrites and auth.
- Azure DevOps pipelines (`azure-pipelines*.yml`) orchestrate build/test/deploy across frontend and backend, with environment variables and secrets expected via pipeline variables or Azure App Settings.

## Current Limitations & TODO Hooks
- Medscheme integrations and beneficiary email dispatchers are queued via database logs but still marked `TODO` pending API credentials and SMTP provider configuration.
- Sync endpoint `/api/sync/pending` accepts payloads; reconciliation and conflict resolution strategies will need to be strengthened before go-live in unreliable network conditions.
- Some administrative reports rely on placeholder metrics until their underlying stored procedures are finalised.

## New Requirements (Captured 10 Oct 2025)
- Integrate with the Chronic Disease Management Programme (CDMP) end-to-end, closing the loop with Medscheme.
- Generate proactive alerts to Medscheme when beneficiaries require additional chronic care interventions.
- Dispatch visit file closure summaries to beneficiaries via email automatically when a file is closed.
- Continuously push patient-care updates back to Medscheme for situational awareness.
- Enforce POPIA-compliant delivery: beneficiaries 18+ receive their own reports, while dependents under 18 route to the main member.
- Extend ERP workflows to accommodate CSI initiatives and non-member patients without breaking reporting.
- Embed indemnity form capture within the clinic intake workflow (digital acknowledgement stored alongside visit records).

### Stakeholder Notes (2 Oct 2025 Conversation)
- “System must integrate with Chronic Disease Management Programme.”
- “System must alert Medscheme that patients need additional care (chronic).”
- “System upon file closure must send by email the file report to the beneficiary.”
- “Data must always push back to Medscheme so they know what’s going on.”
- “POPIA dictates that reports for 18 and above must be sent to the dependent, not the main member.”
- “ERP must accommodate the prospect of the CSI element—meaning accommodate non-members.”
- “Indemnity form must be embedded onto the clinic.”

## Next Steps to Consider
- Wire the existing medscheme alerting and sync logs into the actual partner APIs once credentials are available.
- Implement the outbound email/SMS worker that drains `visit_closure_notifications` and chronic program alerts.
- Finalise CSI/non-member visit flows, including differentiated billing, stock consumption, and reporting.
- Map the indemnity workflow into patient registration (UI step + backend persistence) and expose acknowledgement in visit closure reports.
