# Ticket 4 — NEW_UXUI_frontend + BE_KN source integration

Date: 2026-10-08. Integration branch: `integration/newux-be-20261008`.
Status: configuration corrections verified statically; source integration recorded
on the local integration branch.
Live Docker/database acceptance remains pending.

## Inputs

- NEW_UXUI_frontend: `3eb42d7a3990b9df8820a85d564939c0de6a25f7`.
- BE_KN: `240e9e62ca5aa5c429e9e7159414692c2052ae45`.
- Includes the frontend Ticket 1–3 fixes and regression tests documented in
  `../2026-10-08-tickets-1-3/README.md`.
- Current remote heads were checked before this merge and matched these inputs.

## Resolution and configuration

1. `.gitignore` was the only Git conflict. Preserve frontend OS/editor/tool
   ignores, preserve `!.vscode/extensions.json`, and add backend `node_modules/`.
2. In `backend/docker-compose.yml`, nginx's frontend build context changes from
   `../../ltms-frontend/frontend/` to `../frontend/`, matching the combined layout.
3. The backend container connects to MySQL on its internal port `3306`.
   Host development keeps the existing published `127.0.0.1:3307:3306` mapping.
4. SMTP defaults to the existing `mailpit` service on port `1025`, preserving
   explicit SMTP_HOST/SMTP_PORT environment overrides. Backend waits for the
   Mailpit service to start. This fixes container-local `localhost` defaults.
5. Existing frontend Dockerfile already builds with `VITE_USE_MOCK=false` and
   `VITE_API_BASE_URL=/api/v1`. Existing nginx keeps `/api/v1/...` when proxying
   to `backend:8000` and falls back to index.html for frontend routes.

Backend application code and database files match BE_KN exactly. No endpoint,
DTO, backend validation/authentication rule or database migration is changed.
The only backend subtree modification is Docker Compose configuration.
No feat/1 frontend merge or wholesale UI replacement is included.

## Checks

| Check | Result |
| --- | --- |
| Conflict markers / unmerged paths | None after resolution |
| Ignore semantics | node_modules ignored, VS Code extension exception retained |
| Compose YAML parse | Pass |
| Backend/frontend build context and Dockerfile existence | Pass |
| Relative Compose bind-mount sources | All exist |
| Container DB port / SMTP default mapping | Correct against backend config consumers |
| Frontend TypeScript, lint, API-mode production build | Pass |
| Frontend suite | 111 files / 798 tests pass |
| Frontend intercepted-browser flow | 6 viewport/theme cases pass |
| Backend npm ci | Pass |
| Backend typecheck and production build | Pass |
| Backend unit suite | 168 files / 3,426 tests pass, 5 existing todo |
| Backend source/database identity versus BE_KN | Preserved |
| Whitespace check on authored fixes | Pass; imported upstream whitespace is preserved |

`config-checks.json` and backend logs are in this folder. Frontend logs/screenshots
are in the Ticket 1–3 evidence folder. BE unit config blocks real MySQL/S3/SMTP IO.
Frontend source was not changed by the backend merge; its checks are the verified
Ticket 1–3 checks, not a claim of authenticated full-stack acceptance.

## Live execution gate

This machine has no Docker CLI/runtime or local MySQL executable, and this checkout
has no backend `.env`. No containers, migrations, role audit, SMTP acceptance or
`npm run test:int` were run. These are unverified, not passing.

Before live use:

1. Provide Docker and a local backend `.env` following `.env.example`; do not commit
   credentials. Match MYSQL_ROOT_PASSWORD and DB_PASSWORD. Container database port
   is handled by Compose; host development uses 3307.
2. Start services. Run backend migrations before any live API testing, then the
   role audit required by `frontend/CLAUDE.md`; report its result before proceeding.
3. Check signup/OTP, withdrawal history, Admin decisions, database persistence,
   and uploads against real fixtures and SMTP/MinIO.
4. Review storage public addressing for the chosen deployment. Current backend
   signs upload/private-document URLs using `S3_ENDPOINT`, while Compose sets
   `http://minio:9000` for internal communication. That hostname is not normally
   resolvable by a host browser. Public avatars/logos can use the existing
   `S3_PUBLIC_BASE` configuration, but private presigned URLs require an agreed
   backend/deployment solution; frontend must not rewrite signed URLs or invent
   a new API. This inherited backend/configuration gap remains open.
5. Backend still does not enforce email_verified at login, and external signup
   without academic fields needs backend delivery, as recorded in FEAT-1-REMAINING.

The merge is local to the integration branch. No GitHub push or update to team
branch pointers is part of this ticket execution.
