# Home task API coverage

Task-first Home only emits a card when the current response includes the state needed to confirm the viewer can act. Each card links to the existing domain destination; Home does not infer permissions from a status field alone.

| Viewer role | Source | Current endpoint/query | Task rule | Destination | Coverage gap |
|---|---|---|---|---|---|
| Player / invited user | Team invitations | `GET /me/invitations` (`["teams", "backend", "invitations"]`) | Invitation `expiresAt` is valid and after now; show its expiry in task detail | `/teams` | The destination owns the accept response and server 403/409 message. |
| Team Leader | Team readiness | `GET /me/teams` (`["teams", "backend", "mine"]`) | `readinessStatus === Forming` and viewer `role === leader` | `/team/:id` | No task for members because the response does not grant management authority. |
| Invited Referee | Referee invitations | `GET /me/referee-invitations` (`["referees", "me"]`) | One pending invitation row | `/matches` | The list does not expose a narrower invitation route. |
| Referee | Referee requests | `GET /me/referee-requests` (`["referees", "me", "requests"]`) | Incoming request has `status === open` | `/inbox` | Closed and applied requests are not actionable. |
| Player / Team Leader / Organizer / Referee | Composed Match list | `getMyMatches()` → `composeMyMatches()` (`matchKeys.mine`), using the existing reads listed below | Selectors require an explicit true `viewer.can` flag; the current real adapter supplies only false flags | No real Home Match cards currently emitted; supported selector destinations are `/checkin/:id` and `/m/:id` | BE-GAP-R1: missing confirmed action-capability data suppresses every real Home Match action, not only Player self check-in. |
| Organizer | Organizer tournaments | `GET /me/tournaments` (`["me", "tournaments"]`) | Owned row is `private` and not deleted | `/t/:id/manage/progress` | Public and pending approval rows do not claim publish readiness. |
| Admin with confirmed access | Admin tournament requests | Admin access probe followed by `GET /admin/tournament-requests` (`["admin", "tournamentRequests"]`) | Fetch and map only after `useAdminAccess()` returns true | `/admin/requests` | Access errors suppress this source and leave other feeds visible. |

The mock adapter is separate from these endpoints and flattens the existing `workQueue` entries into the same `HomeTask` shape. Backend authorization remains final when a user opens or submits a card.

Guest and signed-out viewers see Tournament discovery and do not mount the real personal task hooks. Staff without confirmed Admin access receive no Admin requests or cards; other permitted sources remain available.

## Match capability limitation — BE-GAP-R1

There is no `GET /matches?assignedToMe=true` request in the current real Home path. `useMyMatches()` calls `getMyMatches()`, which delegates to `composeMyMatches()`. That composition reads `GET /me`, `/me/teams`, `/me/applications`, `/me/tournament-requests`, `/tournaments`, `/me/referee-matches`, and `/tournaments/:id/matches` to find relevant matches. It may also read `/matches/:id/checkins` and `/matches/:id/result` for counts and scores, plus sport types for mode formatting. Those reads do not confirm Home action capabilities.

`matchFromBackend()` initializes every `viewer.can` flag to false. `composeMyMatches()` fills viewer roles and team identity but preserves those false flags. Consequently, no real Home Match action is currently confirmed: open/manage check-in, record/review results, resolve disputes, review check-in, and finish-match cards are all suppressed. Player self check-in also remains unsupported. Selector tests with supplied true flags verify the display contract and destinations, not real-mode integration coverage.

Backend delivery required: server-confirmed viewer action-capability data for the current Match-list path (BE-GAP-R1; also recorded in `FEAT-1-REMAINING.md`). This correction records the gap only. Existing endpoints, DTOs, adapters, permission defaults, and backend code remain untouched; Home does not infer capabilities from roles or status. Backend authorization remains final at each destination.

## Acceptance evidence — 2026-10-04

The full real-mode frontend suite passes (74 files / 446 tests), including expired Invitation filtering, Guest query gating, confirmed Admin denial, independent source retry, and visible 403/409 destination errors. Source-specific Retry accessible names and the current shell navigation state are asserted. The preview returns HTTP 200 at `http://127.0.0.1:5174/`.

The 1280 × 800 / 1440 × 900 walkthrough in both themes and representative role fixtures remains pending: CUA refused Safari access and no browser surface was available. Current test coverage does not prove first-viewport action visibility, rendered long-name wrapping, or absence of page-level horizontal overflow.
