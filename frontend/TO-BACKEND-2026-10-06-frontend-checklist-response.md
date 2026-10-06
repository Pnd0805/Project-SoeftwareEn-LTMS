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
- [ ] External referee approval: the reported failure needs runtime reproduction
  with the relevant admin role; these Checklist changes do not claim it fixed.

FR09 compatibility reads now handle `matchA: null` and show withdrawal reasons.
Full withdrawal creation/management UI and runtime migration 045 remain open.

Validation: 70 test files / 446 tests passed with `--maxWorkers=2`; lint and build
passed. Vite startup and reset-password HTML HTTP 200 passed. No browser or email
delivery acceptance is claimed; existing main-bundle size warning remains.
