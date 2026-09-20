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

Test accounts all use password `abcd1234`:

- `p9201@ku.th` — player, team leader, organizer and referee in one account
- `somchai@ku.th` — admin

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
