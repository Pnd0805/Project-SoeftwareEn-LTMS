# Frontend integration contract — BE_KN 7 Oct 2026

Verified remote/fetched head: `8d161a6d25b1ebc501e1412bde37b911cfdea4de`.
Base URL: `/api/v1`. Source: today's TO-FE and current backend routes/services/mappers.

## Sport BO capability

`GET /sport-types` items include `supportsBestOf: boolean`.
The frontend must not infer capability from a sport name or hardcoded ID.

- `POST /tournaments`, `PATCH /tournaments/:id/format`,
  `PATCH /matches/:id/format` reject non-null `bestOf` for unsupported sports.
- `bestOf: null` is allowed for every sport and clears legacy BO settings.
- Tournament format changes still obey server locks after play starts.

| HTTP | Code | Frontend behavior |
|---|---|---|
| 400 | BEST_OF_NOT_SUPPORTED | Show server message and field error for bestOf; offer clearing a legacy value |
| 403 | CANNOT_SUSPEND_ROOT | Root cannot be suspended; disable Suspend and retain server error for races |
| 403 | CANNOT_SUSPEND_UNIVERSITY_ADMIN | Root must revoke University Admin scope first; disable Suspend |

Backend AppError stores metadata in `extra.fields.bestOf`; the error middleware
spreads extra into the JSON error envelope (`error.fields.bestOf`).
`ApiError.fields` preserves this field metadata. Reinstate is a separate action;
the Suspend restrictions must not disable it.

## Session, visibility and referee identity

- Reset password increments token_version (migration 046). Old tokens get the
  existing `401 TOKEN_EXPIRED`; no new code or global-logout UI is required.
- Anonymous private/pending/rejected match/tournament reads return 404.
  Match detail uses `MATCH_NOT_FOUND`. Propagate errors, do not fall back to mock.
- `GET /me/referee-identity` supports `expired`, approvedAt/expiresAt,
  docsRequired and existing tournament approvals. Expired approval does not
  prevent finishing existing tournaments; a new invitation triggers fresh review.
- Frontend reminder threshold: 30 days before approved.expiresAt. This is UI copy,
  not a server reminder policy.
- `403 EMAIL_NOT_VERIFIED` sends users to the existing OTP flow when delivered.
  Login enforcement remains disabled server-side until SMTP acceptance passes.

## Delivered routes used by this QA implementation

- Team visibility PATCH /teams/:id; join requests GET/POST /teams/:id/join-requests,
  POST .../:rid/approve|reject; GET /me/join-requests; DELETE /me/join-requests/:rid.
- PATCH /me: contactInfo, address, showProfileStats.
- GET/PATCH /me/notification-prefs: server categories/locked flags; critical is immutable.
- POST /users/:id/report: reason + private evidence object keys from report_evidence upload.
- GET /admin/user-reports (page/pageSize), POST .../:id/approve|reject.
  Approval suspends the target; Root cannot review; faculty/university scope is server-owned.
- GET /admin/oversight/stalled: Root/University Admin read-only counts and IDs.
- GET /admin/audit-logs: page/pageSize supported; frontend requests 20 rows per page.
- Announcement create + PATCH/DELETE /announcements/:id, types general,
  schedule_change, venue_change, result, livestream.
- Reported comments GET /tournaments/:id/comments?reported=true; reviews GET
  /tournaments/:id/feedback; university-admin moderation uses existing feedback routes.

Missing routes/data and live acceptance are tracked in the QA checklist and BE response.
