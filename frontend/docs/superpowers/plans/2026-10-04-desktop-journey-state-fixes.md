# Desktop journey state fixes implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make existing desktop discovery, entry and team screens explain their state and work reliably with a keyboard.

**Architecture:** Preserve current components, route table and query layer. Correct presentation at each component's existing boundary; shared Modal owns dialog focus, while feature components own applicable source states and recovery.

**Tech Stack:** Existing React, TypeScript, TanStack Query, React Router, Vitest and Testing Library.

**Spec:** `frontend/docs/superpowers/specs/2026-10-04-desktop-journey-state-fixes.md`

## Global constraints

- Frontend components/tests only; no API adapters, DTOs, hook implementations, backend, store or rules edits.
- Existing mutation payloads, permissions, routes and business rules remain authoritative.
- Short English labels, existing LTMS tokens and Bold Street identity; no new dependency.
- Sol 6.1 High workers; shared-file ownership is explicit. No commit or push.
- Run focused checks per task; full gates after integration. Browser and live-backend acceptance remain pending.

## Review focus

- Disabled Guest queries remain pending: do not show perpetual loading or suppress a genuine empty result (Tasks 3/5).
- Hidden, disabled or later-mounted dialog controls: focus stays within the active dialog without resetting on rerender (Task 1).
- Lost connection after a submission: preserve choices, report an unconfirmed outcome and avoid automatic replay (Task 2).
- One source fails while another has usable data: retain that data and retry only the failed source (Tasks 3/4).
- Approved count/rules unavailable: do not advertise capacity or eligibility based on fabricated empty values (Task 3).

### Task 1: Keyboard-safe named Modal

**Files:** `src/components/kit/Modal.tsx`, `Modal.test.tsx`.
**Interfaces:** preserve `Modal({open,onClose,label,title,children})` and `ConfirmCard` public props.

- [x] Add failing behavioral cases for named dialogs, hidden/disabled initial controls, empty fallback, Tab/Shift+Tab, Escape/latest callback, backdrop, opener restoration and rerender stability.
- [x] Run `npx vitest run src/components/kit/Modal.test.tsx`; confirm the missing behavior fails.
- [x] Implement shared focus/name handling; inspect simultaneous/nested callers before deciding active-dialog handling.
- [x] Rerun Modal plus existing registration/confirmation caller suites; require pass.
- [x] Read-only review and scoped diff check; leave uncommitted.


### Task 2: Registration outcome and selection feedback

**Files:** `src/features/tournament/RegisterForm.tsx`, `RegisterForm.test.tsx`.
**Interfaces:** preserve RegisterForm props and submitted `{teamId,playerIds}`; consume existing sport range.

- [x] Add failing cases for announced network rejection, retained players, persistent selected count and unchanged payload. Retain server-rejection/context-switch cases.
- [x] Run `npx vitest run src/features/tournament/RegisterForm.test.tsx`; confirm the new assertions fail.
- [x] Add the spec's unconfirmed-outcome fallback, announced errors and persistent count. Keep real unverified checks neutral and mock rules unchanged.
- [x] Rerun registration and registrationErrors suites; require pass.
- [x] Read-only review and diff check; leave uncommitted.



### Task 3: Discovery and entry source states

**Files:** `SearchPage.tsx`/tests, `TournamentPage.tsx`/focused state tests, `ScheduleTab.tsx`/focused state tests, `EntryPanel.tsx`/focused state tests under their existing feature folders.
**Interfaces:** preserve routes, hooks, query keys and compatible props; consume existing enabled arguments. Optional internal EntryPanel confirmation/feedback state and a narrow RegisterForm feedback slot are permitted to retain an open form and expose source recovery during a retryable refresh failure.

- [x] Add cases for Guest public-empty/short results, isolated source retry, safe 404 versus network/500, schedule failure versus empty, Guest Entry private reads disabled, team-read failure, and unconfirmed rules/capacity.
- [x] Run the named focused new/existing suites and confirm new assertions fail.
- [x] Correct applicable-state rendering and source-specific retry; keep successful data. Gate private reads with existing enabled arguments and do not render unrestricted/fullness claims from unavailable data.
- [x] Rerun discovery/entry state suites plus realModeBoundary; require pass with a mock regression.
- [x] Read-only review and diff check; leave uncommitted.


### Task 4: Independent Teams sections

**Files:** `src/features/team/TeamsPage.tsx`, `TeamsPage.states.test.tsx`, existing invitation tests.
**Interfaces:** preserve existing query hooks and mutation payloads/callbacks.

- [x] Add cases for Teams failure with usable invitation/application, independent pending/error states, simultaneous errors and isolated retries, plus empty/success and stale invitation-error preservation.
- [x] Run Teams state/invitation suites and confirm new assertions fail.
- [x] Retain heading, render each source independently and name retry actions. Require settled applicable success before empty wording.
- [x] Rerun focused Teams suites; require pass.
- [x] Read-only review and diff check; leave uncommitted.


### Task 5: Team identity and contextual actions

**Files:** `src/features/team/TeamPage.tsx`, existing Guest tests and focused accessibility tests.
**Interfaces:** preserve TeamPage props, private access applicability, member/leader/staff controls and mutations.

- [x] Add cases for Team h1, signed-in Teams parent, public Guest parent, named repeated actions, and Guest disabled private pending without roster loading/data.
- [x] Run focused cases and confirm missing behavior fails.
- [x] Correct semantics and applicable roster states; preserve authenticated staff access and all lock/business rules.
- [x] Rerun TeamPage Guest/management tests; require pass.
- [x] Read-only review and diff check; leave uncommitted.


## Integration

- [x] Run TypeScript, lint, full real-mode Vitest and build.
- [x] Confirm empty API/DTO/hook implementation diffs for this correction batch, whitespace checks and one Impeccable detector pass.
- [x] Record correction reviews and remaining browser/backend acceptance. Leave preview running and changes uncommitted.
