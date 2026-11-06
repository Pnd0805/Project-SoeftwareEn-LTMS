# FE response to QA Round 5 — 7 Oct 2026

Verified ls-remote/fetched `BE_KN@234e4a15183ac9f64f66d2242afc531623ee02f1` and inspected source at that ref. Frontend baseline `7940cf6`, branch `feat/1`. Changes are frontend-only. Browser/manual QA was excluded by the user; this response records implementation and developer checks.
FE implementation commit: `65da597`.

Superseded status: [Round 6 response](TO-BACKEND-2026-10-08-qa-round6-response.md) integrates team conflict metadata, updates the 9053 key and selects FE-39 option A. The remaining-work section below records the Round 5 snapshot.

## Closed FE implementation

1. **Review opening reason:** integrated openedBy into the feedback DTO and community view. event_start uses the scheduled Bangkok start; first_match and completed explain actual play/completion without presenting future opensAt as the opening date. not_started labels the date as scheduled; closed states closure. Null/unknown data uses neutral open copy. canSubmit remains the sole authority for displaying the submit form. No event chronology is inferred.
2. **Tournament/amendment queue permission:** GET /me.adminScope controls queue hooks and tabs. Root and Faculty Admin without an assigned faculty issue no queue reads; direct /admin/requests and /admin/filters explain the required scope. Assigned Faculty and University Admin retain queue access. A server 403 remains an access error, not "Nothing waiting". Cache keys include the actor and scope; stale cached rows/counts and confirmations are hidden after a scope change or read error. Root's existing scope management, audit and oversight tabs remain available.
3. **MinIO 9054 FE compatibility:** verified BE seed/compose delivery. The frontend already consumes opaque HTTP presigned URLs; a regression test now covers the full new referee_identity/9054/...png URL without rewriting it. Existing 9053 missing-file recovery and 20-minute link refresh remain. No additional FE object-key parser is needed.

## Correction to the Round 5 remaining-work table

The Round 4 FE integration is already committed in `d2755b5`; status/handoff is in `7940cf6`. ALREADY_APPLIED handling, referee expiry/re-invite, structured role conflicts, own-result recovery/onsite resubmission, standings outLabel, organizer amendment preview and removed-feedback history are implemented. They should not remain listed as waiting for FE implementation. Authenticated runtime and browser acceptance are separate and are not newly closed here.

The user confirmed migrations were run after Round 4. FE did not rerun migrations or independently verify the live schema this round. Please do not describe 049/050 as confirmed unrun on the FE machine; that statement is older than the user's confirmation. No full DB reseed or compose reload was performed by FE.

## Still required from BE / team

- **FE-39:** organizer-only POST /tournaments/:id/amendment-requests/preview does not provide impact to another admin before approval. Deliver reviewer-authorized impact by request ID, or include affected teams/players/blockers in the scoped admin queue/detail. FE does not send an unauthorized organizer preview or invent counts. Round 5 changes queue authorization, not this contract.
- **Team invitation conflict metadata:** the previously inspected POST team invitation error only supplies tournamentId/role. For pending-versus-accepted and expiry recovery on that screen, supply structured invitationStatus/expiresAt or the conflict array used by registration. Round 5 delivers no additional metadata there; FE displays it when actually supplied and does not parse messages.
- **Fixture deployment/acceptance:** BE owns population of the valid 9054 object and matching DB row in the existing local QA environment. Seed/compose source delivery is closed; actual image opening/expiry is not verified this round. Preserve 9053 as the intentional 404 case and avoid full reseeding of existing QA data.
- SMTP/OTP enforcement, team decisions B2/B4/cancellation/identity policy and remaining live/browser/device acceptance remain open under the existing handoff.

## Original checklist

**41 implemented / 2 partial:** FE-10 browser performance timing and FE-39 reviewer pre-approval impact. Round 5's delivered FE integration can close at implementation level; it does not close these remaining contracts or full-system acceptance.

## Developer validation

- Final full suite: `npm.cmd test -- --maxWorkers=2` — **97 files / 599 tests passed**.
- `npm.cmd run lint` passed; TypeScript/production build passed. Existing chunk-size warning remains (main 941.47 kB).
- Isolated Vite port 5195 started with strictPort. Root HTML and AdminPage, useAdmin, LiveCommunityTab and adminQueueAccess modules returned HTTP 200; task-owned Vite was then stopped.
- Git diff whitespace check passed. No new live API, browser or real-device pass is claimed. Commit requested; no push performed.
