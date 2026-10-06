# FE response to the 3–5 October Checklist — 2026-10-06

Verified target: remote `BE_KN@63045d17188cec87577122dc4146de423073abbf`.
Frontend implementation and developer checks are complete for Checklist A1–A6,
B1–B5 and C1–C4. Live acceptance stays open in `FEAT-1-REMAINING.md`.

- [x] D1: the email URL is `/reset-password?token=<64 hex>`; public, reads the
  query token unchanged and POSTs `{ token, newPassword }`. `/forgot-password`
  POSTs `{ email }` and uses neutral acknowledgement copy.
- [x] D2: predictions POST `{ scoreData: { '<teamId>': number, ... } }`.
  OD-69 supersedes B3: tolerance comes from the match, points from sport-types.
- [x] D3: resend uses a 60-second cooldown and 3/hour copy. HTTP 200 is described
  as request acceptance, not proof that an email was sent.
- [x] D6 interim artwork: FE uses the existing trophy icon as a fallback for all
  current null `iconKey` values. No new image assets or guessed storage URLs.
- [ ] D4: human-readable criteria beyond the delivered description remain a
  product/backend choice. FE currently displays the delivered name/description.
- [ ] D5: progress such as 7/10 is not in the inspected reward DTO. No progress
  is inferred from earned badge count or unrelated profile totals.
- [ ] D6 final artwork: decide the badge assets and their delivery/read contract
  before replacing the fallback.
- [ ] U04: retain the open issue where a team withdraws before result verification
  and profile totals differ from career/history. The FE does not silently recompute
  totals or change the award criteria.
- [ ] F14: need cross-tournament coverage counts after rescheduling to complete
  the organizer warning reported by the user. Invitation acceptance checks alone
  do not close this case.
- [x] External referee decision FE error: the user reproduced a synthetic 404
  thrown by the FE adapter after a successful backend decision. This FE defect
  is fixed and the user confirmed Approve plus assignment/acceptance/match access
  passed. Reject and organizer active-count persistence remain unconfirmed.

FR09 compatibility reads now handle `matchA: null` and show withdrawal reasons.
Withdrawal creation/management UI was subsequently delivered below. Local migration 045 was
subsequently applied during OTP recovery, as recorded below.

Validation: 70 test files / 446 tests passed with `--maxWorkers=2`; lint and build
passed. Vite startup and reset-password HTML HTTP 200 passed. No browser or email
delivery acceptance is claimed; existing main-bundle size warning remains.

## Subsequent local Auth acceptance — 2026-10-06

The user confirmed OTP/recovery email reception in local Mailpit and successful
password reset. The user also confirmed a different new password can log in,
the old password cannot, a used reset link cannot be reused, and incorrect or
expired OTP is rejected. These are user-reported runtime checks, separate from
the delivery-time developer validation above.

Local DB migrations 035–045 were applied successfully; the OTP table now exists.
Mailpit is available at `http://localhost:8025`. Local backend `FRONTEND_URL` was
aligned to the running frontend at `http://localhost:5173` and the watcher reloaded.
No backend source content was changed.

Still open: resend cooldown/quota, leading-zero OTP, expired reset link, and
external SMTP/inbox delivery. No additional feature acceptance is closed here.

## External referee decision follow-up — 2026-10-06

Fetched remote `BE_KN@8a75156f8102a2a091301817d62275ad3a00f1ab`; AR02 still
returns `{ userId, identityStatus, tournamentsUpdated }`, not a request-detail DTO.
FE now treats successful AR02/AR03 writes as acknowledgements instead of throwing
`NOT_FOUND`. The existing success flow refreshes the queue and referee reads;
match permission/list reads are also invalidated. No backend source was changed.

23 focused API/UI tests, lint and production build passed. Approve/Reject notices
and queue refresh are tested. The user subsequently confirmed the External
Approve retest passed on 2026-10-06. The reported Admin decision error is closed;
The user also confirmed assignment -> External acceptance -> match management
access succeeded on 2026-10-06. Reject with reason and organizer active-count
persistence after reload remain unconfirmed separately.

## Remaining FE workflow delivery — 2026-10-06

Target verified/fetched again: `BE_KN@8a75156f8102a2a091301817d62275ad3a00f1ab`.

- [x] U11-backed External Profile states, expiry/admin message, guarded initial
  document submission/resubmission using M16 purpose `referee_identity` and U12.
  Only JPEG/PNG, 1–5 files; submission waits for successful uploads and sends keys.
- [x] AR04 request-docs UI with a required reason (maximum 500 characters),
  queue refresh and document metadata. Approve/Reject still use AR02/AR03.
- [x] FR09 discriminated payloads, reason 5–500 characters, match/tournament
  withdrawal creation, organizer review/history with confirmation and latest reads.
  Requests remain pending until the organizer consents; stale/cancelled responses
  are not shown as successful withdrawal. Existing Inbox supports cancellation.
- [x] Amendment changes use readable values in both organizer and Admin screens.
- [ ] Required backend read contract: AR01 currently returns `docs: string[]`
  containing raw private keys. Neither refereeAdmin.routes nor upload.routes
  exposes an authorized download endpoint, and AR01 supplies no signed URLs.
  Please provide Admin-authorized, expiring read URLs for these files, with missing
  file/error responses. The FE shows count/names and does not open public storage URLs.
- [ ] Optional rewards criteria/progress/final artwork still require an agreed
  read contract/assets. Existing catalogue/descriptions/trophy fallback remain usable.
- [ ] User browser acceptance for these new flows remains deferred as requested.

Final developer validation: full suite passed 74 files / 464 tests; lint and
production build passed. The existing >500 kB main-bundle warning remains.
An isolated Vite server on 127.0.0.1:5189 returned HTTP 200 for Profile, tournament
referee management and the new component modules, then was stopped. This confirms
development serving, not browser or live-backend acceptance of the new workflows.
