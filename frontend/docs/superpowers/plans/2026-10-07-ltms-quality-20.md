# LTMS Quality 20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking. The current request is for documents only; do not execute tasks from this plan until it is reviewed.

**Goal:** Raise each verified LTMS task surface toward 20/20 under a repeatable five-dimension rubric, targeting at least 18/20 and closing all 28 observed UI findings.

**Architecture:** Retain the React route, query, mutation and permission contracts. Repair common semantics/contrast first, then task-first desktop journeys, then the mobile shell and preview/runtime fidelity. Keep each ticket reviewable, record a fresh /20 baseline and score only observed states at the final gate.

**Tech Stack:** Existing React 19, TypeScript 6, React Router 7, TanStack Query, React Hook Form/Zod, Base UI, Vitest, Vite 8, current Minimal Street CSS and self-hosted fonts.

**Spec:** [LTMS Quality 20](../specs/2026-10-07-ltms-quality-20.md)

**Tickets:** [Q10–Q23 register](../tickets/2026-10-07-ltms-quality-20.md)

## Authorized two-worktree execution split (2026-10-08)

Create both worktrees from the same `ltms-desktop-ux` base revision and the same captured dirty-working-tree snapshot. Do not commit, merge or push this program. Keep Q23 for the later integration/acceptance stage after the user has reviewed both worktrees.

| Worktree | Assigned scope | File ownership rule |
|---|---|---|
| `ltms-q10-q20-layout` | Q10 first, then Q13–Q20: shared design foundation, task-first Desktop surfaces, and Mobile shell | Sole owner of `src/styles/prototype.css` and shared shell/kit presentation during this split. Complete Q10 before editing its downstream layouts. |
| `ltms-q11-q12-quality` | Q11–Q12 and Q21–Q22: action/recovery, registration/moderation, preview fidelity and route loading | Does not edit `src/styles/prototype.css`, shared Tabs/Shell, or the files owned by Q10/Q20. Any needed styling stays feature-scoped. Q11 and Q21 share ProfilePage in this same worktree. |

Both workers use Sol 6.1 High. They work from isolated Orca worktrees and leave changes available for user review on separate development-server ports. These instructions preserve API routes, DTOs, payloads, permissions and domain rules. Existing dirty source/document changes are copied into each worktree before either worker starts; the original worktree remains untouched. Q23 is not assigned to either worker and is not started while the two versions remain unmerged.

Implementation order within the first worktree is Q10 → Q13–Q19 → Q20. The second worktree may work in parallel after the shared starting snapshot is ready. Do not copy edits from one new worktree to the other while workers are active.

## Global Constraints

- All paths below are relative to frontend/. Work only under frontend/.
- Preserve current API paths, DTOs, hook contracts, mutation payloads, permission decisions, domain rules and existing source-state behavior. Do not edit backend code. Unsupported capabilities go in FEAT-1-REMAINING.md.
- Keep the existing dark/light plum/cream/teal family, 2px corners, 232px Desktop sidebar, colored Team role frames and Tournament wall popup. Use concise English UI wording.
- Desktop 1280×800 and 1440×900, both themes, is the first acceptance phase. Mobile 390×844, 320px/reflow, then physical iPhone Scan/safe-area is a subsequent acceptance phase.
- For each surface, target >=18/20 under the spec's five dimensions, every dimension >=3, no open P1 and no failed hard gate. “Unverified” never earns 4. Technical /20 is separate.
- Existing inherited uncommitted Ticket 09 and Scan changes are part of the starting working tree. Capture their status and relevant file hashes before implementation; do not overwrite, revert or present them as newly authored work.
- Do not create tests that only repeat CSS values. Write a failing behavior test for each changed interaction or concrete regression risk, then implement the minimal fix. Inspect CSS changes in a browser.
- Run focused tests at each task and the full quality gates in Q23. Record evidence; no commit or push unless the user explicitly requests one.
- Avoid worktree or agent orchestration unless subsequently authorized; this document does not dispatch workers.

## Review Focus

These five input/failure classes are easy to miss while polishing the happy path. Each has an owning task with an explicit test or device check.

1. A user has Organizer, Referee and Player responsibilities in different Tournaments: Q11 tests capability-specific Next action, Q13 checks task-first route visibility without leaking organizer content.
2. Register reference data loads late or a faculty changes while an old department is selected: Q12 tests blank defaults and stale department rejection.
3. 30 Referee tasks are all in one category while three categories are empty, including long Team names: Q15 tests category selection, actions and retained scroll/drafts.
4. Search or Inbox has partial-source failure while another category succeeds: Q17 tests successful content retention, retry and untouched request status.
5. Camera permission is denied on iOS or a scan starts on insecure HTTP: Q11 tests failure state, Q20 checks existing secure/file branches on a physical device; keep device acceptance unverified until run.

## File ownership and dependency map

| Ticket | Primary source ownership | Consumes |
|---|---|---|
| Q10 | shared prototype.css, kit/primitives.tsx, Schedule headers, semantic shell | Existing tokens/components |
| Q11 | MatchNextStep, CaptureModals/GlobalScanDialog, ProfilePage | Existing capabilities, camera/query hooks |
| Q12 | RegisterPage, AdminFeedbackTab, contextual community/audit entry | Existing RegisterInput and moderation mutations |
| Q13 | TournamentPage, its Bracket/Dashboard/Manage composition, Home preview facts | Q10 common hierarchy |
| Q14 | HomeWorkspace/HomeTaskPanel/NextMatchPanel and Home CSS | Q10 common styles |
| Q15 | MatchesPage, ResultForm/StatSheet and bounded queue CSS | Q10 common styles |
| Q16 | RequestPage and RefereePanel | Q13 Organizer hierarchy |
| Q17 | InboxPage/BackendInbox, SearchPage, feature CSS | Q10 common styles |
| Q18 | TeamPage/TeamManage and Team CSS | Q10 shared tabs |
| Q19 | AdminPage/child tabs and Admin CSS | Q10, Q12 target context |
| Q20 | Shell responsive composition and shell CSS | Accepted Desktop shell, Q10 |
| Q21 | ProfilePage mock summary, MvpPage, WatchPage | Existing mock/real contracts |
| Q22 | App.tsx route imports, loading/error boundary | Stable route structure |
| Q23 | Dated quality evidence and completion ledger | All tickets |

The old prototype.css owns many feature rules. Edit it sequentially after Q10 where necessary; extract a feature-scoped stylesheet only when it clearly reduces conflicting ownership. Do not create a second duplicate global design system.

## Before the first task

- [ ] Record current branch/HEAD, git status and hashes of all source files likely to be touched; include inherited dirty files in the baseline. Keep the record under a new dated frontend/docs/superpowers/notes/ file.
- [ ] Re-score the sampled routes with the new /20 rubric in the same fixtures used by the review. Record each of the five dimension scores or “unverified”, viewport/theme/state and evidence. Do not convert the old /10 scores by multiplication.
- [ ] Confirm the local mock server and its current port before browser verification. Do not stop the user-requested local servers. Do not access the live backend without the CLAUDE.md migration and role-audit gates.

---

### Task Q10: Shared contrast, language and semantic controls

**Files:** Modify src/styles/prototype.css, src/components/kit/primitives.tsx, src/components/layout/Shell.tsx, src/features/tournament/ScheduleTab.tsx and only the shared table producers that have unnamed action columns. Create src/components/kit/Tabs.quality20.test.tsx if shared tab behavior is changed. Reuse src/components/layout/Shell.profile.test.tsx and ScheduleTab.discovery.test.tsx.

**Interfaces:** Preserve Tabs({ tabs, active, onPick }) and existing route/kit component props. Local button groups may expose aria-pressed; any true role=tab widgets must implement their complete selection/keyboard pattern. Shared color token for text on teal is the existing accent-ink/light-accent-ink pair.

- [x] **Step 1 — Write behavior tests.** Assert current navigation is announced, the selected local control exposes state, left/right or ordinary Tab behavior matches its chosen semantic pattern, and a Schedule action column has a nonempty accessible name.
- [x] **Step 2 — Run the new cases.** Run npx vitest run src/components/kit/Tabs.quality20.test.tsx src/components/layout/Shell.profile.test.tsx src/features/tournament/ScheduleTab.discovery.test.tsx. Expected: new semantic assertions fail before the fix, existing behavior remains visible.
- [x] **Step 3 — Implement.** Fix semantics and shared copy without renaming backend concepts. Use the correct text token on light teal headers; keep Barlow display, Geist work text and Rubik Dirt preview roles.
- [x] **Step 4 — Verify.** Rerun the same focused command and npx tsc --noEmit -p tsconfig.app.json. Expected: exit 0.
- [x] **Step 5 — Inspect.** Measure computed light Schedule header contrast >=4.5:1 at 1440/390, check dark theme and focus/current state with keyboard. Record screenshot and calculation in the task note.

Q10 implementation and rendered contrast/semantics evidence: [worker-layout.md](../notes/quality20/worker-layout.md). Full cross-role scoring remains Q23.

### Task Q11: Correct Next action, Scan recovery and Profile retry

**Files:** Modify src/features/match/MatchNextStep.tsx, src/features/checkin/CaptureModals.tsx, src/features/checkin/GlobalScanDialog.tsx only if its separate status path needs the same correction, src/features/profile/ProfilePage.tsx, scoped CSS. Create src/features/match/MatchNextStep.quality20.test.tsx. Extend CaptureModals.test.tsx and ProfilePage.test.tsx.

**Interfaces:** MatchNextStep({ m, result }) remains unchanged. The derived action has label, supported href/section and focus target from the same Match state/viewer.can decision. Register no new Match capability. Profile Retry calls the existing statsQuery.refetch().

- [x] **Step 1 — Write failing cases.** Settled result says View history and opens History; Referee/Organizer/Player multi-role fixtures show only supported actions; denied camera does not announce Starting camera; invalid code is announced and remains editable; failed Profile stats exposes Retry and preserves account details.
- [x] **Step 2 — Run.** Run npx vitest run src/features/match/MatchNextStep.quality20.test.tsx src/features/checkin/CaptureModals.test.tsx src/features/profile/ProfilePage.test.tsx. Expected: the new assertions fail for the observed faults.
- [x] **Step 3 — Implement.** Use one action selection for copy/destination/focus. Derive Scan visible status with error precedence, provide one local asynchronous error announcement and compact the failed preview; keep photo/manual paths supported by the current implementation. Add Retry stats.
- [x] **Step 4 — Verify.** Rerun the focused command and TypeScript. Expected: exit 0 with unchanged API and Match permissions.
- [x] **Step 5 — Inspect.** Capture 1440 dark and 390 light camera denial/invalid states; confirm Cancel/Retry/input are reachable, Escape returns trigger focus, and no stale loading text appears.

Q11 implementation and recovery evidence: [worker-quality.md](../notes/quality20/worker-quality.md). Physical iPhone camera and live backend remain unverified.

### Task Q12: Intentional Register fields and contextual Admin moderation

**Files:** Modify src/features/auth/RegisterPage.tsx, src/features/admin/AdminFeedbackTab.tsx, plus a contextual entry in src/features/tournament/LiveCommunityTab.tsx or the AdminAuditTab component in src/features/admin/AdminGovernanceTab.tsx only if supported data makes it identifiable. Create src/features/auth/RegisterPage.quality20.test.tsx and src/features/admin/AdminFeedbackTab.quality20.test.tsx. Add FEAT-1-REMAINING.md note only for a proven missing target lookup.

**Interfaces:** A valid submit still supplies RegisterInput to useRegister without changing its schema or API payload. Admin removeFeedbackByAdmin(id, reason) and restoreFeedbackByAdmin(id) signatures stay unchanged. Target context carries known id, author/tournament/excerpt where available; absent context blocks blind mutation.

- [x] **Step 1 — Write failing tests.** Untouched student fields cannot submit; a late faculty list does not auto-select a person’s identity; changing faculty invalidates prior department; a deliberate valid draft submits exactly the present payload shape; a raw ID with no target context cannot trigger Remove/Restore; a known selected target is named before mutation.
- [x] **Step 2 — Run.** Run npx vitest run src/features/auth/RegisterPage.quality20.test.tsx src/features/admin/AdminFeedbackTab.quality20.test.tsx. Expected: new assertions fail.
- [x] **Step 3 — Implement.** Use empty local draft values and map validated values through existing registerSchema. Do not alter server validation. Carry moderation context from an existing visible comment/review or audit record; require an identifying confirmation and existing role permission. If no supported source can identify restoration, expose that limitation and log the dependency.
- [x] **Step 4 — Verify.** Rerun focused tests, existing src/api/admin.contract.test.ts and src/api/liveEngagement.test.ts if present, plus TypeScript. Expected: exit 0, no API adapter/DTO change.
- [x] **Step 5 — Inspect.** Capture blank Register, field-error retention and contextual Admin confirmation. Record which moderation state remains unsupported, if any; do not award it an 18/20 yet.

Q12 frontend implementation and contextual moderation evidence: [worker-quality.md](../notes/quality20/worker-quality.md). Historical feedback restoration still needs a supported lookup; see FEAT-1-REMAINING.md. The moderation /20 acceptance score remains withheld.

### Task Q13: Task-first Tournament composition and preview fact labels

**Files:** Modify src/features/tournament/TournamentPage.tsx, DashboardTab.tsx, BracketTab.tsx, manage/ManageTab.tsx, src/features/home/HomePage.tsx, feature-scoped CSS in prototype.css. Reuse BracketTab.navigation.test.tsx, journeySourceStates.test.tsx and HomePage.preview.test.tsx; create src/features/tournament/TournamentPage.quality20.test.tsx for the new task order.

**Interfaces:** Current /t/:id/:tab/:sub routes, permission/organizer checks and preview props remain. Full details move to Overview/disclosure; visibility and phase labels use only supported source fields.

- [x] **Step 1 — Write failing behavior tests.** Working Bracket/Manage route presents local navigation then its own task before duplicate Details/Entry; Organizer sees organizer wording; Guest/denied route hides private work; preview labels Public as Visibility without invented phase.
- [x] **Step 2 — Run.** Run npx vitest run src/features/tournament/TournamentPage.quality20.test.tsx src/features/tournament/BracketTab.navigation.test.tsx src/features/home/HomePage.preview.test.tsx. Expected: new ordering/fact assertions fail.
- [x] **Step 3 — Implement.** Add compact identity/status strip and move generic facts behind Overview/disclosure. Retain all facts and current route behavior. Update preview fact labels from known data only.
- [x] **Step 4 — Verify.** Rerun focused tests and TypeScript. Expected: exit 0.
- [x] **Step 5 — Inspect.** At 1440×900 and 390×844 record document y of first bracket/task item and compare against old y857/y1689; confirm no missing information or horizontal page overflow.

Q13 implementation and first-match measurements: [worker-layout.md](../notes/quality20/worker-layout.md). Q20 later reduced the 390px shell; full mobile acceptance remains Q23.

### Task Q14: Equal Home peers sized for their actual content

**Files:** Modify src/features/home/HomeWorkspace.tsx, HomeTaskPanel.tsx, NextMatchPanel.tsx only if a density state is needed; otherwise limit to the Home section of src/styles/prototype.css. Reuse HomeWorkspace.test.tsx, HomeTaskPanel.test.tsx and NextMatchPanel.test.tsx.

**Interfaces:** Existing feed/match props and 18px task count remain. Equal desktop outer height is a pair-level rule; long lists retain a bounded internal scroll.

- [x] **Step 1 — Record the observed failure.** With one task and no next match, measure current two equal 320px bodies and first Tournament card near y880. With many tasks, record current bounded behavior.
- [x] **Step 2 — Implement the proposed revision.** Use shared compact sparse-state sizing for both peers and a shared bounded size for dense states. Keep equal-height Desktop frames and natural-height stacked Mobile frames.
- [x] **Step 3 — Verify source behavior.** Run npx vitest run src/features/home/HomeWorkspace.test.tsx src/features/home/HomeTaskPanel.test.tsx src/features/home/NextMatchPanel.test.tsx and TypeScript. Expected: exit 0; counts, source errors and match selection unchanged.
- [x] **Step 4 — Inspect.** Compare 1280/1440 sparse and 30-task fixtures in both themes; equal heights hold, long tasks scroll, first Tournament card appears materially earlier in sparse state, Mobile has no fixed blank slab.

Q14 sparse/dense Home measurements: [worker-layout.md](../notes/quality20/worker-layout.md).

### Task Q15: Referee task board and score entry

**Files:** Modify src/features/matches/MatchesPage.tsx, src/features/match/ResultForm.tsx and StatSheet.tsx where needed, related .refgrid/.match-work-bucket CSS in src/styles/prototype.css. Extend MatchesPage.workspace.test.tsx and ResultForm.workspace.test.tsx.

**Interfaces:** Existing useMyMatches result, match links, ResultForm draft/mutation payload and assigned-referee permission checks remain. Category selection is local UI state, not server filtering.

- [x] **Step 1 — Write failing behavior tests.** 30 tasks in one category show count and selected queue; three empty categories do not occupy working columns; category changes keep the correct tasks and stable navigation; team/player filtering in ResultForm keeps edited scores/stats and makes missing required fields reachable.
- [x] **Step 2 — Run.** Run npx vitest run src/features/matches/MatchesPage.workspace.test.tsx src/features/match/ResultForm.workspace.test.tsx. Expected: new assertions fail, old permission/payload cases still pass.
- [x] **Step 3 — Implement.** Use counted category controls, two selected card columns at Desktop and one at Mobile. Keep bounded queue with visible continuation cue and footer action. Put score/required stats first; add local filter/disclosure without changing what must be sent.
- [x] **Step 4 — Verify.** Rerun focused tests and TypeScript. Expected: exit 0, no draft loss or changed result payload.
- [x] **Step 5 — Inspect.** Screenshot 1440×900 30-task/empty-category state and 48-player form, test keyboard traversal, long names, low viewport height, and result validation.

Q15 evidence and existing real-path sport-name/browser-control limitations: [worker-layout.md](../notes/quality20/worker-layout.md). Await per-ticket local review before Q16; Q23 remains deferred.

2026-10-08 user-requested queue redesign: [primary-source research and rationale](../notes/quality20/2026-10-08-referee-work-research.md); [confirmed rendered evidence](../notes/quality20/q15-redesign-confirm/measurements.json). Compact match sheets retain Q15 behavior; 674 tests pass. Await review of the revised local queue before Q16.

### Task Q16: Organizer request and staffing truth

**Files:** Modify src/features/request/RequestPage.tsx and src/features/tournament/manage/RefereePanel.tsx; scoped CSS. Reuse RequestPage.test.tsx and RefereePanel.groups.test.tsx.

**Interfaces:** Current Request submit payload and referee appointment/assignment data remain. Accepted-count and required-per-match are distinct values; no unsupported overall coverage percentage is computed.

- [x] **Step 1 — Add a focused count assertion.** A fixture with accepted=6 and requiredPerMatch=2 renders separate labels, never “6 of 2 accepted”. Existing request test asserts unchanged submit payload and retained draft after error.
- [x] **Step 2 — Run.** Run npx vitest run src/features/request/RequestPage.test.tsx src/features/tournament/manage/RefereePanel.groups.test.tsx. Expected: new count case fails before correction.
- [x] **Step 3 — Implement.** Group the Request form into Tournament/Schedule/Eligibility, shorten help and add a review summary; relabel referee counts truthfully. Do not infer match coverage without match assignment data.
- [x] **Step 4 — Verify.** Rerun focused tests and TypeScript. Expected: exit 0.
- [x] **Step 5 — Inspect.** Compare form length and first actionable area at 1440×900 in both themes; use a 6/2 staffing fixture and check source error state.

Q16 evidence: [worker-layout.md](../notes/quality20/worker-layout.md), [final footer/color check](../notes/quality20/q16-after/footer-check.json). Focused 16 and full 677 tests pass; TypeScript/lint/build pass. API payloads and staffing rules unchanged. Await per-ticket local review before Q17; Q23 remains deferred.

### Task Q17: Action-first Inbox and categorized Search

**Files:** Modify src/features/inbox/InboxPage.tsx, BackendInbox.tsx, src/features/search/SearchPage.tsx and search-inbox-workspace.css. Extend InboxPage.workspace.test.tsx and SearchPage.workspace.test.tsx.

**Interfaces:** Notification read mutations and BackendInbox request mutations remain separate. Search continues to use the existing tournament/team/user sources and permitted-result filtering.

- [x] **Step 1 — Write failing tests.** A pending request appears before paginated notifications; Mark all read leaves its request status untouched; failure keeps the action available; search category controls jump/filter to known types; tournament result remains visible when player search fails.
- [x] **Step 2 — Run.** Run npx vitest run src/features/inbox/InboxPage.workspace.test.tsx src/features/search/SearchPage.workspace.test.tsx. Expected: new priority/navigation cases fail.
- [x] **Step 3 — Implement.** Put Needs action first with count and bounded list, keep Updates after it; add category counts/anchors to Search and a human-readable unknown-sport fallback.
- [x] **Step 4 — Verify.** Rerun focused tests and TypeScript. Expected: exit 0; existing payloads and partial-source behavior pass.
- [x] **Step 5 — Inspect.** At 1440×900 pending action is initially visible; long 19-result Search reaches each category quickly; partial error still shows useful results.

Q17 evidence and the existing mock Inbox limitation: [worker-layout.md](../notes/quality20/worker-layout.md), [rendered confirmation](../notes/quality20/q17-after/measurements.json). Focused 44 and full 681 tests pass; TypeScript/lint/build pass. First desktop action y1574→344. Await local review before Q18; Q23 remains deferred.

### Task Q18: Team Manage frame density

**Files:** Modify src/features/team/TeamPage.tsx, TeamManage.tsx and scoped Team styles in src/styles/prototype.css. Reuse TeamPage.accessibility.test.tsx, TeamManage.logo.test.tsx and current Team role/tab tests.

**Interfaces:** Existing Members/Invites/Manage selected-panel and draft state remain. The approved 440px equal Desktop frames are retained.

- [x] **Step 1 — Capture before.** Measure equal frames and blank Manage area in a 1280px Leader fixture; record keyboard tab behavior and role-loss state.
- [x] **Step 2 — Implement.** Top-align concise routine action rows, separate dangerous actions, keep exact one visible panel and TeamRecord's stable position. Mobile may use natural height.
- [x] **Step 3 — Verify.** Run npx vitest run src/features/team and TypeScript. Expected: pass with retained drafts, privacy and role state.
- [x] **Step 4 — Inspect.** Measure equal Members/Invites/Manage widths/heights at 1280/1440; inspect Manage at 390 and long Team name. No filler copy/metrics.

Q18 evidence and the TeamPage reuse ruling: [worker-layout.md](../notes/quality20/worker-layout.md), [before](../notes/quality20/q18-before/measurements.json), [after](../notes/quality20/q18-after/measurements.json). Focused 50 and full 682 tests pass; TypeScript/lint/build pass. Equal desktop frames remain 440px; drafts, role-loss privacy and desktop TeamRecord position are retained. Await local review before Q19; Q23 remains deferred.

### Task Q19: Compact Admin working area

**Files:** Modify src/features/admin/AdminPage.tsx and selected child tab presentation plus scoped Admin styles in src/styles/prototype.css. Reuse AdminPage.requests.test.tsx, AdminQueues.workspace.test.tsx and AdminGovernanceTab.test.tsx.

**Interfaces:** Existing Admin access probe, scope checks, review mutations and Q12 moderation context remain. No new bulk action.

- [x] **Step 1 — Capture before.** Record top of selected request task at 1440×900 and repeated chrome/description blocks.
- [x] **Step 2 — Implement.** Reduce vertical nav/description repetition while keeping grouped scope and per-item identity/review. Keep bounded queue and action footer.
- [x] **Step 3 — Verify.** Run npx vitest run src/features/admin and TypeScript. Expected: all denial, review and mutation cases pass.
- [x] **Step 4 — Inspect.** Confirm selected task and one actionable item in initial Desktop viewport, both themes and long names. Confirm denied scope does not show cached private content.

Q19 evidence and the full-width amendment-row ruling: [worker-layout.md](../notes/quality20/worker-layout.md), [before](../notes/quality20/q19-before/measurements.json), [final confirmation](../notes/quality20/q19-confirm/measurements.json). Focused 32 and full 684 tests pass; TypeScript/lint/build pass. Navigation 197→128px; Tournament and Rule change decisions are initially visible at both desktop widths/themes. Named queues, decline drafts and denied-cache privacy remain. Await local review before Q20; Q23 remains deferred.

User review revised Q19 navigation to equal desktop columns with larger group headings and vertical child links. Latest [evidence](../notes/quality20/q19-equal-nav/measurements.json) and [geometry checks](../notes/quality20/q19-equal-nav/navigation-check.json) supersede prior navigation measurements: 184px nav; first Tournament action remains fully visible at both desktop widths. Admin 32/full 684 tests and TypeScript/lint/build pass. Await local review; Q20/Q23 remain untouched.

### Task Q20: Mobile shell and Scan reachability

**Files:** Modify src/components/layout/Shell.tsx, shell responsive rules in src/styles/prototype.css and relevant Shell tests. Preserve current Scan dialog/photo components unless Q11 exposes a shared issue.

**Interfaces:** Desktop Sidebar/route access, useNav, navSection and global Scan trigger remain. Mobile account/logout move behind Profile or a named menu; Scan stays an immediate action.

- [x] **Step 1 — Write failing navigation test.** At mobile semantics, main nav and Profile remain reachable; current route is announced, Scan trigger opens the same secure-origin path, and insecure HTTP still selects photo capture. Reuse Shell.profile.test.tsx and GlobalScanDialog.test.tsx.
- [x] **Step 2 — Run.** Run npx vitest run src/components/layout/Shell.profile.test.tsx src/features/checkin/GlobalScanDialog.test.tsx. Expected: new mobile behavior assertion fails before implementation.
- [x] **Step 3 — Implement.** Compact mobile header and accessible navigation drawer/focused menu; keep Desktop sidebar untouched.
- [x] **Step 4 — Verify.** Rerun focused tests and TypeScript. Expected: pass.
- [x] **Step 5 — Inspect.** Measure shell before main content <=120px at 390, check 320px reflow, both themes, long names and keyboard focus. Record physical iPhone safe area/camera/file-capture evidence; if device unavailable, leave device score unverified.

Q20 implementation evidence: [worker-layout.md](../notes/quality20/worker-layout.md), [rendered measurements](../notes/quality20/q20-after/measurements.json), [interaction checks](../notes/quality20/q20-after/interactions.json). Shell before main is 115.6px at 390/320; desktop sidebar remains 232px. Focused 20/full 689 tests and TypeScript/lint/build pass. Physical iPhone safe area/camera/native photo capture remains **unverified**. Await local review; Q23 stays deferred until integration.

### Task Q21: Mock facts and Watch next action

**Files:** Modify only the mock display branch of src/features/profile/ProfilePage.tsx, src/features/mvp/MvpPage.tsx and src/features/watch/WatchPage.tsx. Read src/shared/career.ts for the existing careerByTournament source; leave src/api/user.ts unchanged. Reuse ProfilePage.test.tsx and MvpPage.test.tsx. Create src/features/watch/WatchPage.quality20.test.tsx.

**Interfaces:** Mock totals use same-scope career facts; real-mode stats remain server-owned. MVP real voting model is per-match. Watch uses existing Match/Tournament routes only.

- [x] **Step 1 — Write failing tests.** Mock Profile totals agree with career or explicitly name different scope; mock MVP identifies Match MVP and closed eligibility correctly; Watch empty/unavailable view has a working View bracket/Open match route without a fake replay.
- [x] **Step 2 — Run.** Run npx vitest run src/features/profile/ProfilePage.test.tsx src/features/mvp/MvpPage.test.tsx src/features/watch/WatchPage.quality20.test.tsx. Expected: new facts/navigation cases fail.
- [x] **Step 3 — Implement.** Derive mock Profile confirmed played/won display from the same byTour rows rendered below, and show a title only from an established finish value; otherwise display unavailable. Align MVP mock scenario with the existing per-match model. Add supported Watch empty-state links. Leave the mock API return shape and real server stats untouched.
- [x] **Step 4 — Verify.** Rerun focused tests and TypeScript. Expected: exit 0.
- [x] **Step 5 — Inspect.** Compare mock/real-contract screenshots; mark active voting and real streaming unverified if not exercised.

Q21 mock/real-contract evidence: [worker-quality.md](../notes/quality20/worker-quality.md). Live voting and streaming remain unverified.

### Task Q22: Route-level loading and error recovery

**Files:** Modify src/App.tsx; src/components/layout/ErrorBoundary.tsx only for a proven chunk-retry gap; TournamentPage.tsx only if ManageTab is separated lazily. Create src/App.lazy.quality20.test.tsx.

**Interfaces:** Preserve all existing route paths and Guard/Shell permission gates. React.lazy modules must retain named exports via the existing component names. Suspense fallback is named and stays within the shell; ErrorBoundary still protects the route.

- [x] **Step 1 — Capture equivalent build baseline.** Record main and async chunks, gzip sizes, browser cold-load trace and route list on the current working tree.
- [x] **Step 2 — Write failing route tests.** Admin/Request/Match navigation renders a loading state before the chunk; a failed chunk gives retry/back; restricted routes still redirect/deny; healthy routes retain current heading.
- [x] **Step 3 — Run.** Run npx vitest run src/App.lazy.quality20.test.tsx. Expected: new lazy/failure assertions fail with current static imports.
- [x] **Step 4 — Implement.** Add route-level lazy boundaries for the heaviest routes, optional ManageTab split where justified, Suspense and stable error recovery. Preserve separate lazy ZXing loading.
- [x] **Step 5 — Verify.** Rerun focused tests, TypeScript and npm run build. Expected: pass; compare all chunks, not only the main file. Check the proposed <=200 kB gzip main target in an equivalent build, plus route navigation under cold load.

Q22 route, recovery and bundle evidence: [worker-quality.md](../notes/quality20/worker-quality.md). Integrated and cross-role acceptance remain Q23.

### Task Q23: Final per-surface and technical acceptance

**Files:** Create a dated evidence record under docs/reviews/ and a completion ledger under docs/superpowers/notes/; update Q10–Q23 status only after each gate passes. Product source is outside this task unless a newly discovered defect gets a separate fix.

**Interfaces:** Consume the spec rubric and all Q10–Q22 evidence. Output a matrix with each surface's five scores, worst required state, screenshot/test link, open finding and remaining dependency.

- [ ] **Step 1 — Inventory.** Enumerate the app route/role/task matrix from App.tsx and the review's per-surface list, including Guest, Player, Team Leader, Organizer, Referee and Admin.
- [ ] **Step 2 — Run source gates.** Run npx tsc --noEmit -p tsconfig.app.json, npm run lint, npx vitest run and npm run build. Expected: each exits 0; record counts and any warnings.
- [ ] **Step 3 — Run rendered gates.** Check 1280×800 and 1440×900 in dark/light; normal, empty, long, loading, denied/unsupported, partial error and recoverable mutation failure where relevant; keyboard/focus/contrast. Check 390×844, 320px/reflow and a physical iPhone for Scan as the subsequent Mobile phase.
- [ ] **Step 4 — Score honestly.** Apply five 0–4 dimensions separately to every surface and state. Publish the worst required result per surface, desktop and mobile progress separately, technical /20 separately and Nielsen /40 separately. Never fill missing evidence with a 4.
- [ ] **Step 5 — Review and close.** Compare 28 original U findings and all 14 tickets with evidence. Any surface below 18, dimension below 3, open P1, missing backend context or unavailable device check remains open/unverified with a follow-up owner. Record the exact files changed against the starting dirty baseline. Do not call the overall program 100% until all applicable gates pass.

## Execution and review rhythm

After each ticket: focused test/inspection, one direct source review, evidence in its ticket note, then update its status. Q23 repeats full gates and independent visual/product review if a reviewer is available and authorized. Q10–Q22 frontend implementation is recorded in the two Quality20 worker commits and notes. Q23 remains the cross-role acceptance gate; historical feedback restoration, physical iPhone capture and live backend checks remain unverified. No push has been performed.
