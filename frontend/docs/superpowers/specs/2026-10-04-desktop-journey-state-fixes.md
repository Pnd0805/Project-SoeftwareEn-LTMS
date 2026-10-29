# Desktop journey feedback and accessibility corrections

Date: 2026-10-04
Scope: existing Guest, Player and Team Leader screens; correction batch within the approved common UX design

## Intent and panel decisions

Continue the user-authorized review → discussion → spec/ticket → implementation workflow. Three Sol reviewers explored the existing screens and agreed on corrections to keyboard access, recoverable feedback and independent data-source states. Preserve the accepted English copy, LTMS identity, desktop priority and business flows. This batch does not introduce a new Tournament overview or navigation model.

## Required behavior

1. **Dialogs:** preserve `Modal` props and visual treatment. Every open dialog has an accessible name from title/label, falling back to `Dialog`. Initial focus skips hidden/disabled controls, with the dialog as a fallback. Tab/Shift+Tab remain within the active dialog; Escape and backdrop continue to close through the latest callback. Restore the connected opener on close. Ordinary rerenders must not reset focus; new asynchronous content participates in keyboard navigation. Check representative callers and any simultaneous dialogs.
2. **Registration:** preserve selected players, team/tournament context, payload and server decisions. Announce non-ApiError failures: `Could not confirm registration. Check your entries before retrying.` Never replay a mutation automatically. Keep a persistent selected count and the existing sport minimum/maximum where known. Server-specific reasons stay visible and announced; unverified real-mode checks use neutral explanatory styling. Mock-mode local validation remains unchanged.
3. **Discovery and entry:** only applicable query states govern loading/empty messages. Guest player-search queries cannot suppress public no-results feedback. Short searches retain any available public results. Errors have source-specific Retry actions while successful content remains visible. Invalid IDs and actual 404 retain safe unavailable wording; 403, network and 5xx are not described as nonexistent or empty. Schedule failures are not `Nothing scheduled yet`. Entry uses existing private-query enabled arguments for known signed-in users, and distinguishes failed reads from no eligible team. Unknown capacity or eligibility must not imply zero approved teams or unrestricted entry. Retryable background failures must retain mounted registration choices and personal content, while suppressing a new registration start until prerequisites are confirmed.
4. **Personal Teams:** keep the page heading and independently available Teams, Invitations and Entries visible when one source loads or fails. Each applicable source has its own loading/error/empty handling and labelled Retry. Retain mutation notices/errors after rows disappear, privacy disclosure, payloads and destructive confirmations. Permission denials remain explicit rather than being turned into successful empty results.
5. **Team detail:** use a semantic Team h1. Signed-in viewers return to Teams; Guest public navigation remains accessible. Add player context to repeated Remove, Hand over, Invite and Profile accessible names. Gate all private roster loading/error/data rendering on existing access applicability, preserving authenticated staff access. Guest viewers receive the access explanation without a disabled query's loading message. Do not change roster management permissions or lock policy.

## Boundaries

- Change only frontend components and focused tests. No edits to API adapters, DTOs, hook implementations, backend, shared store or shared business rules.
- Preserve all endpoint calls and mutation payload shapes. Existing hook `enabled` arguments may be used by components. Backwards-compatible optional internal EntryPanel confirmation/feedback props and a narrow RegisterForm feedback slot may communicate public-read state and expose recovery within the active dialog without changing backend contracts.
- Retain the Bold Street visual system; avoid new dependencies or unrelated layout replacement.
- No commits or pushes without the user asking.

## Acceptance

Keyboard tests cover named dialogs, hidden/disabled controls, focus cycling/restoration and callback rerenders. Registration tests cover a network rejection, retained selection/count, server feedback, team switching and unchanged payload. Query-state cases cover Guest disabled reads, real empty results, 404 versus 500, partial failures, isolated retries and mock-mode regression. Team detail cases cover Guest/member/authorized staff rendering and named actions. Run required TypeScript, lint, real-mode test suite, build, scope/whitespace checks and one Impeccable detector after integration.

The real 1280 × 800 / 1440 × 900 walkthrough remains pending because Computer Use access to Safari and Orca is denied. No rendered visual claims are made. Local backend port 8000 currently has no listener, so live backend validation is also pending; local preview remains mock.

## Deferred journey findings

Keep these in the next focused design: Tournament Overview/default tab and entry placement; safe sign-in return destination; application success/detail follow-up and refresh; actual roster-lock semantics; multiple-year eligibility display; stale captain-transfer explanation; Profile/public-player return links; broader management grouping. Their deferral is a design boundary, not removal from the system-wide UX program. Missing capabilities and unsupported join/self-leave/history integrations remain contract gaps.
