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
cd C:/Users/DELL/Projects/ltms-backend-shokun2/backend && npm run migrate && npm run dev
```

**Then run the role audit, every time, and tell the user what it found before doing anything else:**

```bash
python C:/Users/DELL/Projects/Project-SoeftwareEn-LTMS/frontend/scripts/audit-roles.py
```

The backend blocks new rule-breaking cases through its API, but rows written straight into the
database never meet those checks — and `qa-baseline.sql` itself ships twelve of them (found
2026-09-29: ปกรณ์ competing in t22/t23, which he organizes; สมหญิง and มานะ refereeing tournaments
their team entered; สมชาย refereeing his own t2/t4). Every restore brings them back. The script
checks six rules, each cited from the spec: organizer competing in their own tournament · referee
on a team entered in the same tournament · organizer refereeing their own tournament · referee on
either team of the match they officiate · a match past `scheduled` without enough referees ·
a check-in decided by someone who is not that match's referee. Exit code 1 = cases found (listed
with ids), 0 = clean, 2 = database unreachable. Never "fix" a case by guessing which role to drop —
report it and ask.

Test accounts all use password `abcd1234`:

- `p9201@ku.th` — player, team leader, organizer and referee in one account, but **never two of
  those in the same tournament**: organizes t14, referees t19/t21, plays in t18/t22/t23/t28.
  (Until 2026-09-29 he organized t22/t23 while his team played in them — a conflict of interest
  the API refuses. t22/t23 now belong to `somchai@ku.th`. A baseline restore undoes this; the
  audit below will say so.)
- `somchai@ku.th` — admin, **university-wide** (`admin_scopes.scope_type`)
- `admin.eng@ku.th` — admin, **faculty 1 only**. `seed-test.sql` has always
  defined this account but `qa-baseline.sql` does not ship it, so a restored
  database has one admin and no way to test faculty scope — which is where
  auto-approval and `ELIGIBILITY_OUT_OF_SCOPE` actually differ. Re-add after a
  restore with the two inserts in `seed-test.sql` (user 9004 + its
  `admin_scopes` row).

Roll test data back without shifting a single id (replaces the prototype's "reset mock"):

```bash
python database/qa-baseline.py restore
```

## Working in this code

- Comments are Thai and explain why the obvious thing was wrong, not what the line does. Match the
  density of the file you are in.
- Thai text inside a bash heredoc breaks on this machine. Use Edit, or write a Python file and run
  it; prefix Python that prints Thai with `PYTHONIOENCODING=utf-8`.
- `src/api/match.ts` is ~1300 lines and `api/admin.ts`, `api/tournament.ts`, `types/match.dto.ts`
  are several hundred — grep or read a range, don't pull them in whole.

Slice ownership, query-key namespaces and frozen files: `PLAN.md`. Screen contract:
`FRONTEND-SPEC.md`. Where the real-mode migration stands: `FEAT-1-REMAINING.md`.
