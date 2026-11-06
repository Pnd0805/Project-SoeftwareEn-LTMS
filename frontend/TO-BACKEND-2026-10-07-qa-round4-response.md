# FE response to QA Round 4 — 7 Oct 2026

Verified ls-remote/fetched `BE_KN@7e37d9374d5a6ae42370a6d6a58ed5d1e2a5cec9` and inspected routes, services, middleware and mappers at that ref. Frontend baseline `8a17a20`, branch `feat/1`. Only frontend code/documents changed.
FE implementation commit: `d2755b5`.

Round 5 supersedes the openedBy/MinIO delivery status below: [latest response](TO-BACKEND-2026-10-07-qa-round5-response.md). Other contract gaps remain open as described there.

User confirms migrations have been run. FE did not run migrations or independently retest the schema. Browser/manual QA was excluded at the user's request; live API fixture checks were not rerun this round. The closures below describe implementation and developer checks.

## Integrated Round 4 contracts

1. **ALREADY_APPLIED:** registration explains an existing pending/approved team application separately from PLAYER_ALREADY_REGISTERED. BE's migration 049/index-specific duplicate handling resolves the previously reported source/schema conflict. Historical failing API evidence is retained; no new live pass claimed.
2. **Referee expiry:** backend computed status `expired` survives the adapter even when stored invitationStatus remains pending. Pool shows expiry; search can invite the same person again. My-invitations does not invent expiresAt because that DTO does not expose it. A stale accept returning REFEREE_INVITATION_EXPIRED displays the supplied deadline, refreshes the inbox and asks for a new invitation.
3. **Role conflicts:** invitationStatus/expiresAt drive pending versus accepted recovery. Pending: invitee declines or organizer cancels, or wait for expiry. Accepted: end the incompatible role/membership. Registration still explains that unchecking a selected player does not resolve the server's whole-team conflict check.
4. **Own-result recovery:** resultStatus/mode controls guidance, without parsing messages. Submitted onsite: resubmit through the score form (now exposed for assigned referees). Submitted online: edit with reason. Verified in either mode: another authorized party disputes or a result complaint follows the normal dispute window. No resubmission UI on verified results.
5. **FE-32:** outLabel preserved exactly with nullable values, no bracket math or sorting. Undecided elimination rows show that outcome is not yet decided. Round robin retains rank/table without an elimination column.
6. **Organizer amendment preview:** POST exact requestedChanges/reason before submission. Show every blocker, delivered team/player impact and separate pendingAmendmentId. Send requires matching successful preview and canSubmit; changing the draft invalidates preview. Errors do not permit submission. Preview never calls the write endpoint. Pending-approval direct faculty/year correction remains its separate flow.
7. **FE-38:** paginated `/admin/feedback/removed` integrated into Admin Feedback alongside per-tournament reported queues. Display content, type, author, tournament, rating, removal time/person/role/reason. Faculty and University may read; Root receives explanatory access state and makes no request. Restore button uses canRestore, reviews the selected content/reason and requires confirmation. Manual ID restoration removed. Successful removal/restore refreshes history and public feedback caches; history cache is separated by viewer/scope/faculty.

## Required clarifications / undelivered scope

- **FE-39 originally concerns `/admin/filters` before approval.** The new preview route uses requireOrganizer. It closes organizer pre-submission impact, but an admin reviewing somebody else's request cannot use it. FE does not issue a known unauthorized request or invent affected counts. Please deliver impact metadata with admin queue/detail, or a reviewer-authorized preview/read route taking the request ID and checking admin scope. Reason/current/requested and impact on server rejection already display.
- **Team invitation conflict metadata:** inspected `team.service.ts` POST team invitation conflict returns `{ tournamentId, role }`, without conflicts/invitationStatus/expiresAt. Registration delivers the new array; FE also handles structured metadata on team/inbox errors whenever supplied. If the team-invitation screen must distinguish pending/accepted and expiry, please add those fields to that route too. FE does not infer them from the message.
- **openedBy** and the valid second MinIO fixture remain explicitly undelivered in Round 4. Retain the agreed B choices from Round 2/3.
- A consolidated global **reported** queue was not delivered; existing reported lists are per tournament. The new route is global scoped **removed** history. FE-38's original manual-ID problem is closed using those lists; a consolidated reported queue is separate additional scope.
- SMTP/OTP gate, token reset, live migration/reapplication acceptance, invitation-expiry runtime acceptance and browser/device QA remain open. B2/B4/cancellation/identity-status decisions remain team-owned.

## Current original checklist

**41 implemented / 2 partial:** FE-10 performance timing (QA) and FE-39 impact before a different admin approves. FE-32 and FE-38 are now implemented. These counts are not full-system QA sign-off.

## Developer validation

- Full suite: **96 files / 576 tests passed**. Focused changed-contract tests: **8 files / 65 tests passed**.
- `npm.cmd run lint` passed; TypeScript/production build passed. Existing chunk-size warning remains (main 939.31 kB).
- Isolated Vite started on port 5194; changed removed-history, amendment-preview and inbox modules served HTTP 200, then FE-owned server stopped.
- Git diff whitespace check passed. No browser/manual QA or new real-API acceptance result claimed.
