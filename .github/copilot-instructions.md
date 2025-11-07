## Quick orientation for AI coding agents

This repository is a full-stack application composed of a Next.js frontend (TypeScript) and a small Flask-based API under `scripts/` that talks to a MySQL database. The goal of these instructions is to give concise, actionable context so an AI can be productive immediately.

Key locations
- `app/` — Next.js (app router). Look here for UI pages, layout, and frontend routes.
- `components/`, `hooks/`, `lib/` — shared UI components, React hooks and client helpers (see `lib/api-service.ts` and `lib/auth-persistence.ts`).
- `scripts/` — Python Flask backend, DB helpers and utility scripts. Important files: `scripts/app.py`, `scripts/run_server.py`, `scripts/create_test_users.py`, many `*.sql` schema/seed files.
- `package.json` & `pnpm-lock.yaml` — frontend dev/test/build commands and dependencies.

Developer workflows (what to run)
- Frontend dev: use the Next.js scripts in `package.json`. Example: `npm run dev` (or `pnpm dev` if using pnpm). Build with `npm run build`.
- Backend dev (Flask): run the Flask dev server with the included runner: `python scripts/run_server.py`. The task `Run Flask server (debug)` is configured in the workspace and runs that script.
- Create test users / seed DB: `python scripts/create_test_users.py` (it uses the DB config environment variables; see notes below).

Environment & DB notes (critical)
- Backend expects MySQL. Common env vars used across `scripts/app.py` and utility scripts:
  - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`
  - Optional SSL: `DB_SSL_CA`, `DB_SSL_DISABLED`
- User/role conventions: roles live in `user_roles` table and code looks up `role_name` strings (e.g. `administrator`, `doctor`, `nurse`). See `scripts/create_test_users.py` for an example of role lookup and user creation.
- Password hashing on the backend uses Werkzeug (`generate_password_hash` / `check_password_hash`) — keep this consistent when adding or verifying users.
- Geographic restrictions are stored as JSON arrays in DB fields (see `create_test_users.py` using a JSON-like string for `geographic_restrictions`).

Backend coding patterns to follow
- Database access: use the repository's `DatabaseManager.execute_query(query, params, fetch=...)` helper pattern which opens a connection, uses a dictionary cursor and optionally returns rows (see `scripts/create_test_users.py` and `scripts/app.py`). Reuse this pattern rather than opening raw connections in multiple places.
- Schema/columns discovery: server code often calls `SHOW COLUMNS` and caches results via `_get_table_columns` — preserve that approach when adding flexible endpoints.
- API surface: endpoints are namespaced under `/api/*` (examples printed by `scripts/run_server.py` include `/api/auth/*`, `/api/patients`, `/api/inventory/*`, `/api/sync/*`). Follow existing route naming and payload shapes.

Frontend conventions
- Uses Next.js app-router and TypeScript. UI state often lives in `hooks/` and `lib/` helper modules. Follow the local component, hook and lib patterns when adding UI features.
- Auth flows integrate with `lib/auth-persistence.ts` and UI components under `components/auth/` — prefer the existing hooks for login/logout and token persistence.

Small, high-value examples (copyable patterns)
- Run backend dev server:
  ```bash
  python scripts/run_server.py
  ```
- Create test users (will insert into `users` table using existing role names):
  ```bash
  python scripts/create_test_users.py
  ```

What to avoid / gotchas
- Do not change password hashing algorithms without updating all places that authenticate/seed users. The Flask API uses Werkzeug hashing; tests and seeders rely on that.
- The codebase uses direct SQL (mysql-connector) in several places. Prefer using the repository DatabaseManager wrapper and follow prepared statements (`%s` placeholders) to avoid SQL injection.
- Many server utilities rely on environment variables for behavior (CORS origins, DB SSL). When testing locally, set minimal env vars in your shell or use `.env` in a local dev setup (no `.env` is committed here).

When you need more context
- Look at `scripts/` first for API behaviour and DB expectations. Then inspect `app/` and `lib/` for how the frontend consumes those APIs.
- Example files to open when working on auth/DB features:
  - `scripts/app.py` (main Flask app, auth and DB helpers)
  - `scripts/create_test_users.py` (role lookups, password hashing example)
  - `lib/api-service.ts` and `lib/auth-persistence.ts` (frontend API client and auth persistence)

If something is unclear, ask the maintainer for the following small facts before editing: the intended default DB host for local dev, whether pnpm or npm is the canonical package manager, and whether new endpoints should be added under `/api/` or as separate microservices.

Please leave any suggested additions to this file as a PR or a comment so maintainers can keep these instructions current.
