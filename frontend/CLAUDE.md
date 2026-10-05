# LTMS frontend

Change files under `frontend/` only — the backend repo and the team's Google Sheet belong to other
people. Commit when asked, not before.

## Verify before saying it works

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npx vitest run
```

All three pass clean as of 2026-09-19, so a failure is yours. (`README.md` still mentions five known
lint errors — stale, they are gone.) Preview with
`preview_start {name: "ltms-frontend"}` → http://localhost:5173.

## Two data stacks, one switch

`USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false"` (`src/api/client.ts`).

| | mock | real |
|---|---|---|
| source | `src/shared/store.ts` + `src/mocks/*`, localStorage `ltms.v1` | `src/api/*` → `src/hooks/*` → `src/types/*.dto.ts` |
| backend | none | `/api/v1`, proxied by Vite to `localhost:8000` |

`.env.local` currently sets `VITE_USE_MOCK=false`. Delete the file to go back to mock.

Conventions the api layer holds to:

- A route the backend does not have returns `unavailable("…")` → rejects `ApiError(501,
  ENDPOINT_UNAVAILABLE)` **without touching the network**. Never guess a path and let it 404.
- `Backend*Dto` is the exact backend shape; the plain `*Dto` is the richer prototype shape.
  `matchFromBackend()` and its siblings fill *every* prototype field with a safe default — screens
  read fields the backend never sends, and one missing `viewer.can` white-screens the whole app.
- Datetimes: `PATCH /matches/:id/schedule` used to reject offsets and `POST /tournaments` to
  reject `Z`. Since A4 (`c9773ca`) the schedule route takes both, so `toZulu()` only normalizes
  the timezone-less value a `datetime-local` input produces.
- Anything the backend still owes gets a `- [ ] Backend delivery required:` line in
  `FEAT-1-REMAINING.md`, with the route and what the frontend does meanwhile.

## Backend (separate repo, not ours to edit)

`C:\Users\DELL\Projects\ltms-backend-shokun2\backend` → `npm run dev`, port 8000.
Docker containers `ltms-mysql` (root/secret, db `ltms`) and `ltms-minio` must be up first — without
MySQL the server exits 4 on boot.

**Always run `npm run migrate` before using the backend — every time, no exceptions.** Every pull
of `BE_KN`, every restart, every `qa-baseline.py restore`, before any live test. It is idempotent,
so running it when nothing is pending costs nothing; skipping it after a pull that added a migration
produces errors that look like backend bugs (missing columns, a `scope_type` value the table will
not take) and wastes a round of reporting. The order is always:

```bash
docker start ltms-mysql ltms-minio
cd D:/Project-LTMS/BE_KN/backend && npm run migrate && npm run dev
```

**Then run the role audit, every time, and tell the user what it found before doing anything else:**

```bash
python D:/Project-LTMS/ltms-frontend/frontend/scripts/audit-roles.py
```

The current baseline at `BE_KN@d5bda6d` includes the approved repairs and schema
034 (verified 2026-10-01: migration check up to date; C1-C8 role audit clean).
Older baselines shipped twelve role conflicts. Keep the audit: API validation does
not protect fixture rows written directly to SQL, and C1-C8 do not check missing
actual end times on completed matches. Exit 1 means conflicts, exit 2 means the
DB could not be reached. Report conflicts before changing roles.

Test accounts all use password `abcd1234`:

- `p9201@ku.th` — player, team leader, organizer and referee in one account, but **never two of
  those in the same tournament**: organizes t14, referees t19/t21, plays in t18/t22/t23/t28.
  (Until 2026-09-29 he organized t22/t23 while his team played in them — a conflict of interest
  the API refuses. t22/t23 now belong to `somchai@ku.th`. The schema-034 baseline includes these repairs; still audit after restore.)
- `somchai@ku.th` — admin, **university-wide** (`admin_scopes.scope_type`)
- `admin.eng@ku.th` - faculty 1 admin (9004), and `root@ku.th` (9099) are
  included in the schema-034 QA baseline. The legacy wrapper previously added
  these accounts to the September baseline; do not reapply it on the new one.

## Current QA baseline (Notice C, 2026-10-01)

`BE_KN@d5bda6d` supplies a complete schema-034 baseline and a restore script that
clears tables before importing. To intentionally reset QA data, use the backend's
`python ../database/qa-baseline.py restore` from its `backend/` directory. Restore
replaces current database data; do not run it merely to inspect the baseline.

`python frontend/scripts/restore-qa.py` (since 2026-10-05) does exactly that in one
command: backend restore → `npm run migrate` → audit. It finds the backend repo itself
(`LTMS_BACKEND_DIR`, sibling `ltms-backend-shokun2`, or `D:/Project-LTMS/BE_KN`). Its
September repair steps run only with `--legacy-repairs`. Do not use that flag on the new
baseline: those repairs are already included.

The migrate and role-audit gates above still apply before live tests. With the
schema-034 baseline migration should report `up to date (34 migrations)`.
Current fixture roles: t14 organizer = 9201; t22/t23 organizer = 9001. Match 1 is
t10 and match 13 is t23. Completed legacy matches 2-6 and 9 may have no actual
end time; never synthesize a deadline from the current time.

## Working in this code

- Comments are Thai and explain why the obvious thing was wrong, not what the line does. Match the
  density of the file you are in.
- Thai text inside a bash heredoc breaks on this machine. Use Edit, or write a Python file and run
  it; prefix Python that prints Thai with `PYTHONIOENCODING=utf-8`.
- `src/api/match.ts` is ~1300 lines and `api/admin.ts`, `api/tournament.ts`, `types/match.dto.ts`
  are several hundred — grep or read a range, don't pull them in whole.

Slice ownership, query-key namespaces and frozen files: `PLAN.md`. Screen contract:
`FRONTEND-SPEC.md`. Where the real-mode migration stands: `FEAT-1-REMAINING.md`.
