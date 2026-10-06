# LTMS Minimal Street Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user chose direct execution and ended orchestration. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved desktop presentation across LTMS, with A's Tournament discovery and palette, B's workspace structure, angular retro street details and a working Tournament preview.

**Architecture:** Keep the existing route table, queries and mutations. Establish shared presentation through the current shell, kit and stylesheet, then adapt the existing journeys. Add only the read-only preview component and its route-level selection state; the prototype's synthetic data remains outside production.

**Tech Stack:** Existing React/TypeScript, React Router, TanStack Query, Base UI Dialog and Vitest stack. Use the installed Geist font and approved self-hosted Barlow Condensed asset.

**Spec:** [LTMS desktop — Minimal Street](../specs/2026-10-05-ltms-minimal-street.md). The [ticket index](../tickets/2026-10-05-ltms-minimal-street.md) owns work ordering and review status. Read the spec before implementation; consult the prototype only for approved visual decisions.

## Global Constraints

- Work under `frontend/` in the existing `ltms-desktop-ux` worktree. Source paths below are relative to `frontend/`; commands run there.
- Freeze `src/api/`, `src/types/`, hook implementations in `src/hooks/`, `src/shared/store.ts` and `src/shared/rules.ts` at this phase's starting working tree. Earlier changes remain intact.
- Preserve payloads, endpoints, permissions and domain rules. Record missing server capabilities; show supported states and actions.
- Keep concise English UI and glossary distinctions. Preserve the previous partial-source, privacy, dialog and registration draft-retention corrections.
- Use A's existing color tokens in both themes, 2px corners, Barlow Condensed Bold for principal headings and Geist for body text and controls.
- Desktop acceptance is 1280 × 800 and 1440 × 900, both themes. Mobile redesign follows this phase; retain responsive usability meanwhile.
- Add behavioral tests for changed behavior. Use rendered inspection for CSS-only decisions rather than tests that repeat CSS values.
- Execute directly. Retain uncommitted work and prototype evidence until the user requests a commit or archival branch. No merge, push or deployment is part of this plan.

## Review Focus

1. Real-mode list data missing capacity, organizer or status: preview must not turn adapter defaults or mock state into facts. Task 2 adds a rendered-page case.
2. A selected private record disappears or its source denies access: preview closes; an arbitrary preview identifier never triggers a new request. Task 2 covers this lifecycle.
3. Deep routes, keyboard navigation and restricted viewers: the correct sidebar parent remains active and only permitted destinations appear. Task 1 extends route and shell coverage; Task 9 checks rendering.
4. A recoverable registration refresh error while a Squad list is selected: retain the open form, selections and unconfirmed outcome. Task 4 reruns the existing regression cases.
5. Missing Match capabilities and QR rendering: retain unsupported-action handling and scanner-specific colors. Task 6 runs existing Match/Check-in coverage; Task 9 inspects actual QR rendering.

## Execution record and interface check

- Before Task 1, record the starting branch/commit, frozen-file names and SHA-256 hashes in this plan's execution ledger. Include inherited uncommitted files; a HEAD-only diff is not the phase boundary.
- The frozen working-tree set is captured in the [API and source baseline manifest](../notes/2026-10-05-ltms-minimal-street-api-baseline.md); compare all 49 hashes during final review, including inherited uncommitted changes.
- Task 1 produces the shared appearance and Home/Tournaments route distinction consumed by Tasks 2–8. Keep existing class names and kit signatures so those pages remain functional during migration.
- Task 2 alone adds the preview callback to Tournament cards and query selection to Home. Task 4 consumes the existing full Tournament destinations, not preview internals.
- Tasks 3–8 share the design system but do not depend on each other's behavior. Execute them in numerical order and scope local layout rules to the relevant feature.
- Task 9 consumes all eight completed slices and their evidence. A missing browser or backend keeps the corresponding acceptance row pending.
- Review directly under the user's no-subagent instruction. Document that the final source review is by the implementer; do not represent it as independent review.

---

### Task 1: Home workspace and shared presentation

**Files:**
- Modify: `src/styles/prototype.css`, `src/components/layout/Shell.tsx`, `src/components/layout/navSection.ts`, `src/features/home/HomePage.tsx`, `src/features/home/HomeTaskPanel.tsx`.
- Create: `public/fonts/BarlowCondensed-Bold.ttf`, `public/fonts/OFL-barlow.txt`, copied from the approved prototype font and its license.
- Test: `src/components/layout/navSection.test.ts`, `src/components/layout/Shell.profile.test.tsx`, `src/features/home/HomePage.real.test.tsx`. Reuse `Shell.admin.test.ts`, `HomeTaskPanel.test.tsx` and `RealHomeTasks*.test.tsx`.

**Interfaces:**
- Consumes: existing `Shell({ children })`, Home task feeds and auth/access query results.
- Produces: `navSection(pathname: string): NavSection | null` with `'/'` for Home and `'/home/all'` for the Tournament route family; existing other section values remain valid. Shared class names and kit interfaces stay stable.

- [x] **Step 1: Add behavioral expectations before changing navigation.** Extend the real Home helper to render a supplied existing route. Assert `navSection('/t/2/manage')` is `'/home/all'`; signed-in `/` has `Home` as its level-one heading; `/home/all` has `Tournaments` as its level-one heading without Needs you; Guest `/` retains discovery without mounting personal feeds. Extend shell coverage to verify separate Home/Tournaments controls, route navigation and the existing keyboard order.
- [x] **Step 2: Run the changed cases.** Run `npx vitest run src/components/layout/navSection.test.ts src/components/layout/Shell.profile.test.tsx src/features/home/HomePage.real.test.tsx`. Expected: the new navigation/audience assertions fail on the old behavior, not on test setup.
- [x] **Step 3: Implement the workspace.** Use `/` and the existing `/home/all` route for the two destinations. Keep the access probe and all mutation handlers. Use clear Home/Tournament headings and remove the unsupported organization/season claim. Present existing source-aware tasks as readable rows. Omit the illustrative Next fixture panel when existing consumed data cannot establish a confirmed fixture.
- [x] **Step 4: Apply the approved material treatment.** Self-host the approved font; keep A's color/QR tokens. Update the current shared CSS for 232px desktop sidebar, a consistent toolbar/content measure, angular controls, condensed principal headings, calm body text and restrained outlines. Keep current mobile fallbacks. Avoid introducing a second permanent stylesheet containing duplicate definitions of the same design system.
- [x] **Step 5: Verify the slice.** Run `npx vitest run src/components/layout src/features/home` and `npx tsc --noEmit -p tsconfig.app.json`. Expected: all cases pass. Record which rendered checks remain pending; no CSS-string tests are required.

**Completion evidence:** [Ticket 1](../notes/2026-10-05-ltms-ticket-01.md). Navigation was partly implemented by the stopped worker; the new Tournament retry case failed before implementation. Task 2 was subsequently authorized by the user's next-ticket continue instruction; Tasks 3–9 remain pending. The approved bounded Home follow-up adds Next match from the already consumed personal Match query in two equal columns; see [follow-up evidence](../notes/2026-10-05-ltms-home-next-match.md). The later approved 320px scroll area and task count are covered by [scroll verification](../notes/2026-10-05-ltms-home-task-scroll.md).

### Task 2: Tournament discovery and preview

**Files:**
- Modify: `src/features/home/HomePage.tsx`, `src/features/home/TournamentCard.tsx`, `src/styles/prototype.css`.
- Create: `src/features/home/TournamentPreview.tsx`, `src/features/home/HomePage.preview.test.tsx`.
- Reuse: `src/components/kit/Modal.tsx`, `src/features/home/homeView.ts` and existing list queries without modifying their contracts.

**Interfaces:**
- Consumes: the currently permitted Tournament list, category relationships and shared `Modal`.
- Produces: optional `onPreview?: () => void` on `TournamentCard`; without it, the card keeps its existing navigation.
- Produces: `TournamentPreview({ open, name, sport, facts, href, onClose })`, where `facts` is `readonly { label: string; value: string }[]`, `open` is boolean, textual props are strings and `onClose` is `() => void`. The component renders facts and navigation only; it does not query or mutate.

- [x] **Step 1: Add rendered-page preview cases.** Cover card activation, the named dialog and its full-page link, Close/Escape and returned focus, Back closing the preview, retained filters, preserved unrelated query parameters, real-mode missing facts, an unknown preview ID and a selected record removed after a resolved refresh or actual access denial. Use real list fixtures and existing test patterns; assert visible behavior and navigation, not hook invocation counts.
- [x] **Step 2: Run `npx vitest run src/features/home/HomePage.preview.test.tsx`.** Expected: failure because card selection still navigates directly and no preview exists.
- [x] **Step 3: Implement preview selection and content.** Use `?preview=<id>` through `useSearchParams`. Resolve it against the current permitted records; retain a valid pending selection while initial data loads, and close a confirmed removed/denied record. Build known facts from available source data, not inferred view defaults. Preserve `/t/:id` or `/t/:id/manage` as appropriate. Use the shared Modal, explicit Close and an `Open tournament` link. Retain A's category/filter/card structure.
- [x] **Step 4: Verify the slice.** Run `npx vitest run src/features/home src/components/kit/Modal.test.tsx` and `npx tsc --noEmit -p tsconfig.app.json`. Expected: all pass; preview adds no API request, new capability or write payload.

**Completion evidence:** [Ticket 2](../notes/2026-10-05-ltms-ticket-02.md). Implemented directly in vertical test/implementation increments. The inherited shared Modal and its regression tests are included unchanged as required preview dependencies. Existing API/DTO/hooks/store/rules remain at the frozen baseline.

**Approved visual follow-up:** [Street art wall](../notes/2026-10-05-ltms-tournament-street-wall.md). Tournament preview gains a generated wall texture, poster headline and sport sticker; other dialogs retain their presentation. Preview behavior and frozen files remain unchanged.

**Approved lettering follow-up:** [Popup typography](../notes/2026-10-05-ltms-tournament-popup-type.md). Replace only the preview headline with self-hosted Rubik Dirt, staggered word strips and a ruby accent; preserve readable facts and controls and compact long headings.

### Task 3: Team and public Player journey

**Approved scope and base:** Ticket 3 only; direct execution from `912e9c7`. Include local intersecting name/sport/role filters, a wider Teams list beside invitations/entries, a street poster Team header, and supported next actions. Preserve inherited Team source/access fixes and their tests. Any inherited `useTeam.ts` correction is a dependency unchanged from the frozen API baseline, not a new hook change.

**Files:**
- Adapt presentation as needed: `src/features/team/TeamsPage.tsx`, `TeamPage.tsx`, `TeamManage.tsx`, `TeamRecord.tsx`; `src/features/player/PlayerPage.tsx`, `BackendPlayerProfile.tsx`, `BackendCareerPanel.tsx`; feature-scoped rules in `src/styles/prototype.css`.
- Reuse existing Team state, invitation, access, accessibility and logo tests.

**Interfaces:**
- Consumes: Task 1 styles and existing Team/Player queries and handlers.
- Produces: the same routes, component contracts and mutation behavior with the approved presentation.

- [x] **Step 1: Inspect the existing journey with the spec.** Identify only presentation gaps after Task 1: headings, source grouping, contextual actions and long-content layout. Retain the current Guest/private-data boundary and separate invitation/membership states.
- [x] **Step 2: Apply the Team presentation.** First prove local filtering at the rendered page seam, then add supported next actions with navigation/focus tests. Group Team members and invitations clearly, preserve outcomes when rows disappear, and style existing management dialogs with the shared system. Use existing data and action handlers. Adapt public Player and Team record long-content layout without new data capabilities.
- [x] **Step 3: Verify.** Run `npx vitest run src/features/team`. Expected: all existing state, invitation, privacy and accessibility cases pass. Add a behavioral case only if implementation introduces behavior not already covered; any such case must fail before its fix.
- [x] **Step 4: Record the rendered cases for Task 9.** Include a long Team name, Guest view, failed invitations with available Teams and a leadership/removal dialog.

**Completion evidence:** [Ticket 3](../notes/2026-10-05-ltms-ticket-03.md). Filters and supported shortcuts delivered, privacy/source/outcome regressions preserved, full suite 84 files / 577 tests passed. Direct standards/spec review and rendered confirmation completed. Staged commit snapshot passes TypeScript and 9 files / 60 Team/Player/Modal tests. Frozen files remain at the captured phase baseline.

**Approved Leader/tabs follow-up:** [Completed evidence](../notes/2026-10-06-team-leader-tabs.md), from `aac49fe`. Leader cards gain the approved poster/sticker treatment. Team details default to Members and show one of Members / Invites / Manage, retain drafts while switching and remove private panels on lost permission. The header shortcut opens Invites and focuses search. Full suite: 84 files / 581 tests; focused Team/Player/Modal suite: 9 files / 64 tests. No frozen API changes.

**Latest visual correction:** [Team name and role borders](../notes/2026-10-06-team-role-colors.md). Removed paper behind list/detail Team names, kept emerald Leader outlines and added amber Member outlines. Team regressions: 7 files / 49 tests, TypeScript/build/lint and both-theme desktop/mobile checks pass; frozen API files unchanged.

**Equal frame refinement:** [Team workspace panel sizes](../notes/2026-10-06-team-equal-panels.md). Members / Invites / Manage have matching full-width 440px frames with internal scrolling and a stable TeamRecord position. Team/Modal regressions: 8 files / 63 tests; build/lint, desktop/mobile computed dimensions, keyboard scrolling and dialog checks pass. Frozen API files unchanged.

### Task 4: Tournament participation and registration

**Files:**
- Adapt: `src/features/tournament/TournamentPage.tsx`, `DashboardTab.tsx`, `ScheduleTab.tsx`, `BracketTab.tsx`, `LeaderboardTab.tsx`, `AnnouncementsTab.tsx`, `CommunityTab.tsx`, `LiveCommunityTab.tsx`, `EntryPanel.tsx`, `RegisterForm.tsx`, `EnterTournamentButton.tsx`; scoped CSS.
- Reuse registration, refresh-retention, source-state, Guest voting, community, Leaderboard and real-mode boundary tests.

**Interfaces:**
- Consumes: shared presentation, current Tournament routes and query states, the existing registration form/feedback interface.
- Produces: unchanged Tournament/registration contracts with coherent page, tab, form and dense-data layout.

- [x] **Step 1: Trace the existing Guest detail and Team Leader entry paths.** Identify presentation changes without altering Hard filter rules, registration decisions or the mounted form's identity.
- [x] **Step 2: Apply the page and registration layout.** Establish identity/state/action hierarchy, readable tabs and contained scrolling for wide bracket/table regions. Apply the user's even-block refinement: consistent grid, aligned edges and matching widths/heights for peer blocks, 20px panel padding and 24px between major groups. Align peer headings/actions, retain frame size through short/empty/loading states and keep dense Schedule/Bracket content in a broad reading area. Narrow screens stack the groups. Preserve selected Squad list, counts, retry controls and submission feedback through recoverable failures.
- [x] **Step 3: Verify.** Run `npx vitest run src/features/tournament`. Expected: all current tests pass, including `EntryPanel.refresh.test.tsx` and `journeySourceStates.test.tsx`. A style migration must not replace those cases with weaker assertions.
- [x] **Step 4: Record rendered cases.** Include a wide bracket, a dense schedule and the open registration form after a retryable source failure. Compare peer block dimensions, edge alignment, spacing and scrolling at both desktop sizes and in both themes; check narrow-screen stacking and long content.

**Completion evidence (2026-10-06):** [Ticket 04](../notes/2026-10-06-ltms-ticket-04.md). Full suite: 86 files / 591 tests; TypeScript, lint and production build passed. API baseline: all 49 frozen hashes unchanged. Desktop 1280×800 and 1440×900 plus 390×844 narrow layouts verified in both themes with HTTP fixtures, native Bracket controls, source-failure draft retention, equal frames and no page overflow. Direct standards/spec review completed; live backend acceptance remains separate.

### Task 5: Organizer setup and review work

**Approved breakdown:** All seven Organizer outcomes in the spec were approved on 2026-10-06. Implement directly from `be1319a`; preserve frozen contracts. Additional behavioral seams: local registration discovery/recovery, retained tab drafts, initial Draw/Close confirmation, Referee grouping, dialog initial focus and authoritative source guards.

**Files:**
- Adapt: `src/features/request/RequestPage.tsx`; `src/features/tournament/manage/ManageTab.tsx`, `SetupTrail.tsx`, `RegistrationsPanel.tsx`, `EntryRulesPanel.tsx`, `EntryFilterPanel.tsx`, `DrawPanel.tsx`, `RefereePanel.tsx`, `MatchRefereePlanner.tsx`, `LiveFeedbackPanel.tsx`, `DeleteTournamentPanel.tsx`; scoped CSS.
- Reuse current Request and management tests.

**Interfaces:**
- Consumes: shared styles and existing setup, registration and Referee-management state.
- Produces: unchanged request/decision interfaces with clear prerequisites, work grouping and outcomes.

- [x] **Step 1: Trace a request, a setup prerequisite and a registration review.** Retain the current values, server decisions and confirmation boundaries.
- [x] **Step 2: Apply the Organizer presentation.** Keep prerequisites beside the related action; group registrations, Referee invitations/appointments and Match assignments distinctly. Preserve all validation, conflict feedback and pending states.
- [x] **Step 3: Verify.** Run `npx vitest run src/features/request src/features/tournament/manage`. Expected: all pass, including setup/referee/draw behavior. New runtime behavior requires a separate failing behavioral case before implementation.
- [x] **Step 4: Record rendered cases.** Include a blocked publish/Draw action, long Player search results and a consequential decision dialog.

**Completion evidence:** [Ticket 05](../notes/2026-10-06-ltms-ticket-05.md). Focused suite: 10 files / 47 tests; final full suite: 89 files / 602 tests. TypeScript, lint and production build passed. All 49 frozen hashes unchanged. Both themes at desktop 1280×800 / 1440×900 and narrow 390×844 checked using HTTP fixtures; 37 captures / 46 records. Direct standards/spec review completed. Live backend verification remains separate.

### Task 6: Match, Check-in and result journeys

**Files:**
- Adapt: `src/features/matches/MatchesPage.tsx`; `src/features/match/MatchPage.tsx`, `MatchWorkflowPanel.tsx`, `FixturePage.tsx`, `ResultForm.tsx`, `ResultTrail.tsx`, `StatSheet.tsx`, `RefereeMatchRequest.tsx`, `LivePickem.tsx`, `SocialBar.tsx`; `src/features/checkin/CheckinPage.tsx`, `CheckinQrPanel.tsx`, `CaptureModals.tsx`; `src/features/mvp/MvpPage.tsx`, `src/features/watch/WatchPage.tsx`; shared `Scorebug.tsx` and scoped CSS only where presentation requires it.

**Interfaces:**
- Consumes: current Match capability flags, result state, Lineup/Check-in behavior and dedicated QR colors.
- Produces: the same Match actions and payloads with aligned participants, score, status and controls.

- [ ] **Step 1: Trace a viewer, Team Leader and assigned Referee view using existing fixtures.** Identify the supported actions in each state; retain missing-capability behavior.
- [ ] **Step 2: Apply the Match presentation.** Keep scores and time units intact, contain wide statistics, preserve result/Dispute feedback and retain QR-specific foreground/background tokens.
- [ ] **Step 3: Verify.** Run `npx vitest run src/features/match src/features/checkin src/features/mvp src/components/kit/Scorebug.test.tsx`. Expected: all existing capability, result, attribution, camera and QR cases pass.
- [ ] **Step 4: Record rendered cases.** Include long Team names, dense Player statistics, QR in both themes, a result dialog and unsupported real-mode action capabilities.

### Task 7: Scoped Admin review

**Files:**
- Adapt: `src/features/admin/AdminPage.tsx`, `AdminGovernanceTab.tsx`, `AdminUsersTab.tsx`, `AdminRefereesTab.tsx`, `AdminFeedbackTab.tsx`, `LeaderTransfersTab.tsx`; scoped CSS.
- Reuse Admin requests, governance, audit and shell-access tests.

**Interfaces:**
- Consumes: existing Admin scope/access results and work queues.
- Produces: identical permitted decisions, with readable rows/details and retained feedback after removal from a queue.

- [ ] **Step 1: Trace a faculty-scoped review, a university-scoped review and an unauthorized staff account.** Use the existing probe and query behavior as authority.
- [ ] **Step 2: Apply the Admin presentation.** Group work types and expose entity, state and decision context; retain named confirmation and success/error feedback.
- [ ] **Step 3: Verify.** Run `npx vitest run src/features/admin src/components/layout/Shell.admin.test.ts src/features/home/RealHomeTasks.adminAccess.test.tsx`. Expected: all pass with no broadened access.
- [ ] **Step 4: Record rendered cases.** Include a long request, an empty scoped queue, a denied account and a decision whose row disappears.

### Task 8: Account, Search and Inbox

**Files:**
- Adapt: `src/features/auth/LoginPage.tsx`, `RegisterPage.tsx`; `src/features/profile/ProfilePage.tsx`; `src/features/search/SearchPage.tsx`; `src/features/inbox/InboxPage.tsx`, `BackendInbox.tsx`; scoped CSS.
- Reuse Profile, Search and both Inbox-mode tests.

**Interfaces:**
- Consumes: current authentication, account editing, search and notification behavior.
- Produces: the same routes and handlers with consistent form, list and feedback presentation.

- [ ] **Step 1: Inspect the sign-in, account editing, empty/failed Search and actionable Inbox states.** Keep the current submit/redirect and permission behavior.
- [ ] **Step 2: Apply the supporting-page presentation.** Use shared fields and actions, readable validation text, contextual labels and stable feedback placement. Keep avatar fallbacks and edited values.
- [ ] **Step 3: Verify.** Run `npx vitest run src/features/profile src/features/search src/features/inbox src/components/layout/Shell.profile.test.tsx`. Expected: all pass.
- [ ] **Step 4: Record rendered cases.** Include auth validation, long Profile/Inbox content, Search failure and an Inbox action that changes the displayed row.

### Task 9: Desktop acceptance and design record

**Files:**
- Create/update: `docs/superpowers/notes/2026-10-05-ltms-minimal-street-acceptance.md`, `DESIGN.md`, `.impeccable/design.json`.
- Retain: the approved `Home.prototype.html` and its assets as prototype evidence until archival is authorized.

**Interfaces:**
- Consumes: Tasks 1–8, phase baseline, spec and the route/rendering cases recorded by each task.
- Produces: a route coverage inventory, verification results, implemented design documentation and explicit remaining acceptance gaps.

- [ ] **Step 1: Account for every route in `src/App.tsx`.** Assign it to one of Tasks 1–8 and record a representative audience/state. Document current permission handling; do not create new access rules from the glossary.
- [ ] **Step 2: Run the required source gates.** Run `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run --reporter=dot`, and `npm run build`. Expected: each exits 0. Record warnings and exact test totals from this run. Compare the frozen-file names and hashes against the phase baseline.
- [ ] **Step 3: Inspect the render through an approved browser surface.** Batch both desktop sizes, both themes and the recorded journey states. Inspect focus order, overflow, long content, modal escape/return and contrast. If browser access is unavailable, leave this step pending and report the exact missing evidence.
- [ ] **Step 4: Complete the bounded Impeccable pass.** Run its detector once on changed UI targets; batch material fixes and confirm with at most one more rendering round. Review directly under the user's no-subagent constraint and distinguish this from independent review. Re-run only gates affected by fixes.
- [ ] **Step 5: Document what is implemented.** Write token-bearing DESIGN.md and the Impeccable sidecar from the final source/rendered evidence. Record the B layout, A palette, angular type/corner treatment, dialog usage and limitations. Keep unresolved visual or backend acceptance visible; a passing source suite is not full rollout acceptance.

## Review and publication state

This plan and the nine separate local tickets are prepared for review. The approved prototype settles the visual choice; the new implementation breakdown and testing seam still need the review required by the explicitly invoked to-spec, to-tickets and writing-plans workflows. No production implementation was started after those document requests arrived.

The repository has no configured issue-tracker destination or triage vocabulary. Keep the local drafts concrete and reviewable; external publication follows tracker setup. This plan adds no approval gate to ordinary reversible implementation work after its review is complete.
