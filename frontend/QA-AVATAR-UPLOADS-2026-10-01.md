# Avatar/logo verification — 2026-10-01

Backend remote/local: `BE_KN@7ea7328`; frontend starting commit: `2a2617a`
plus the current working change. Notice reference: `49faf77`.

## Environment and prerequisite evidence

- Local API `http://127.0.0.1:8000/api/v1`; MinIO `127.0.0.1:9000`.
- `npm.cmd run migrate`: up to date (34 migrations).
- `scripts/audit-roles.py`: exit 0, C1–C8 zero cases.
- `docker compose up --no-deps minio-init`: exit 0;
  anonymous download enabled for `avatar/` and `team_logo/` in `ltms-uploads`.
- Used user 9051 (`referee3@ku.th`) and team 9001 (leader `somchai@ku.th`).
  Both started with null image keys. Removal through the API restored both to
  null; successful test objects were deleted by the backend removal flow.
- The backend was started locally with `npm.cmd run dev` for this smoke test.

## Live HTTP checks

Tests used a valid 1×1 PNG. Tokens, passwords and presigned URLs are omitted.

| Check | Result |
|---|---|
| login referee3@ku.th | PASS |
| login somchai@ku.th | PASS |
| avatar presign | PASS |
| avatar missing object | PASS |
| avatar PUT without Authorization | PASS |
| avatar PATCH key | PASS |
| avatar response contains public URL | PASS |
| avatar anonymous image GET | PASS |
| avatar reload GET keeps URL | PASS |
| login referee3@ku.th | PASS |
| avatar fresh login keeps URL | PASS |
| public user avatar URL | PASS |
| avatar rejects URL as key | PASS |
| avatar removal | PASS |
| avatar removal persists on reload | PASS |
| team_logo presign | PASS |
| team_logo missing object | PASS |
| team_logo PUT without Authorization | PASS |
| team_logo PATCH key | PASS |
| team_logo response contains public URL | PASS |
| team_logo anonymous image GET | PASS |
| team_logo reload GET keeps URL | PASS |
| team_logo rejects URL as key | PASS |
| team_logo removal | PASS |
| team_logo removal persists on reload | PASS |
| nonleader cannot presign logo | PASS |
| unsupported GIF MIME | PASS |
| MyTeam logoUrl contract still absent | PASS |

## Frontend automated verification

- Upload tests cover MIME rejection before network, correct presign body, PUT
  content type without Authorization, backend refusal and storage/network failures.
- Profile and team controls cover saving objectKey/null, permission errors,
  missing files and blocked overlapping uploads.
- Avatar/crest tests cover null/malformed URLs, failed images and replacement URLs.
- Full suite: **48 files / 310 tests passed**. Lint, TypeScript and production
  build passed; `git diff --check` is clean. The existing Vite >500 kB
  bundle-size warning remains. These are developer checks, not browser QA.

## Open acceptance

- [ ] Real-browser chooser → presign → PUT CORS → PATCH, reload/login and removal.
- [ ] Desktop/mobile visuals, denied controls and recovery from network/storage failure.
- [ ] MyTeam/public-profile team logos after the BE DTO follow-up lands.
- `STORAGE_UNAVAILABLE` UI mapping is covered by automated tests; MinIO was not
  deliberately stopped during the live smoke. This is not a full browser QA pass.
