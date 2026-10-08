# LTMS Quality 20 — local ticket register

Status: proposed, unimplemented. Date: 2026-10-07. These Q10–Q23 tickets follow completed Minimal Street Ticket 09; they do not rewrite the old ticket history or create external tracker issues.
Source: [Quality 20 spec](../specs/2026-10-07-ltms-quality-20.md) and [UI metrics review](../../reviews/2026-10-07-ui-metrics/REVIEW.md).
Plan: [Quality 20 implementation plan](../plans/2026-10-07-ltms-quality-20.md).

## Program outcome and score contract

Every applicable route/task surface is rescored under the spec's five × four-point rubric. Completion target is >=18/20 for each required desktop surface, then each required mobile surface, with no dimension <3, no unresolved P1 and no failed hard gate. Technical target is >=18/20, separately. “20/20” is earned through evidence, not assigned from appearance or from the earlier /10 score. The release score for a surface is its weakest required viewport/theme/state result.

These tickets are frontend-only. Preserve existing endpoints, DTOs, payloads, hook contracts, server permissions, domain rules, and inherited working-tree edits. Any unsupported feedback lookup or other backend capability is recorded in FEAT-1-REMAINING.md. Do not mark blocked behavior complete by adding a fake client result. User requested planning documents now, not implementation or commits.

| Ticket | Priority | Owns findings | Dependency | Reviewable outcome |
|---|---|---|---|---|
| Q10 Shared semantics and design tokens | P1 | U06, U13, U20, U21, U22 | None | Consistent readable controls, labels and landmarks |
| Q11 Action and recovery truth | P1 | U03, U04, U05, U16 | None | Match/Scan/Profile communicate correct next steps |
| Q12 Deliberate input and moderation | P1 | U07, U09 | None | Registration choices and feedback target are explicit |
| Q13 Tournament task-first layout | P1 | U01, U26 | Q10 | Bracket/Manage work appears before repeated context |
| Q14 Home density | P2 | U11 | Q10 | Equal desktop peers use space according to content |
| Q15 Referee work and bounded regions | P1 | U02, U27, U28 | Q10 | Real queue gets space; result entry remains recoverable |
| Q16 Organizer forms and coverage | P2 | U14, U15 | Q13 | Request easier to complete; staffing count truthful |
| Q17 Inbox and Search | P1 | U08, U18 | Q10 | Decisions first; result categories reachable |
| Q18 Team Manage density | P2 | U12 | Q10 | Equal tabs remain, useful actions top-aligned |
| Q19 Admin workspace density | P2 | U19 | Q10/Q12 | Scope and review remain clear in less space |
| Q20 Mobile shell | P1 | U10 | Q10 and desktop shell acceptance | Mobile main content starts earlier; Scan remains immediate |
| Q21 Mock fidelity and Watch | P2 | U17, U24, U25 | None | Demo facts and empty actions match supported behavior |
| Q22 Route loading | P2 | U23 | Q10 | Smaller comparable initial bundle with safe loading states |
| Q23 Cross-role quality acceptance | Gate | All U01–U28 | Q10–Q22 | Honest /20 scorecards and regression evidence |

## Q10 — Shared semantics and design tokens

**Scope:** U06, U13, U20, U21, U22. Use current Minimal Street tokens and shared kit. Change only common semantics/copy and affected CSS; feature-specific wording remains in its owning feature.

**Files likely touched:** src/styles/prototype.css; src/components/kit/primitives.tsx; src/components/layout/Shell.tsx; specific Schedule table headers in src/features/tournament/ScheduleTab.tsx and shared table producers. Existing related tests.

**Acceptance:**

- Light Schedule ordinary header text measures >=4.5:1 at 1440/390 and the dark version remains readable.
- Table action columns have accessible names; shell/search landmarks and route/current-tab state are announced correctly.
- Local in-place tabs support the appropriate selected state and keyboard behavior; route navigation uses route semantics.
- Comparable working headings/body/metadata use consistent roles without removing Barlow/Rubik Dirt identity. Team/Squad/Lineup distinctions stay accurate.
- Primary mobile controls aim for 44×44px where practical. No test asserts a CSS literal as a substitute for rendered inspection.

**Proof:** focused component/route behavior tests; contrast measurement and keyboard pass in both themes; screenshot of representative Home, Schedule, Team and Tournament routes.

## Q11 — Action and recovery truth

**Scope:** U03, U04, U05, U16. Existing action permissions, Scan method selection and Profile queries remain authoritative.

**Files likely touched:** src/features/match/MatchNextStep.tsx; src/features/checkin/CaptureModals.tsx; src/features/checkin/GlobalScanDialog.tsx if the same status fault exists there; src/features/profile/ProfilePage.tsx; scoped CSS; existing Match/Check-in/Profile tests.

**Acceptance:**

- For settled, disputed, result-entry, check-in and fixture states, Next action label, supported target and focus destination agree. A role without capability is not offered an action.
- Camera denial/invalid QR never announce “Starting camera”; failure has one understandable recovery step, live announcement, and retained editable input.
- Failed camera preview compacts so Cancel and recovery remain reachable on 390px and enlarged text; Escape returns focus.
- Profile statistics failure has a working Retry stats control; account and other loaded sections remain visible.

**Proof:** role/state navigation tests, denied-camera and invalid-code interaction cases, stats refetch/failure case, desktop/mobile dialog screenshots.

## Q12 — Deliberate registration and identifiable moderation

**Scope:** U07, U09. No backend API addition.

**Files likely touched:** src/features/auth/RegisterPage.tsx; src/features/admin/AdminFeedbackTab.tsx; src/features/tournament/LiveCommunityTab.tsx or the AdminAuditTab component inside src/features/admin/AdminGovernanceTab.tsx only where existing data offers a contextual entry; existing auth/admin/engagement tests.

**Acceptance:**

- Gender, birth date, faculty, department and year begin unchosen. Submit cannot send untouched invented values. A change of faculty invalidates an incompatible department.
- A valid deliberate selection still sends the exact existing RegisterInput shape. Recoverable server field errors retain entered values.
- Remove/Restore targets are displayed with known ID plus available author/tournament/excerpt before mutation. The admin does not infer content from a raw numeric ID. Existing permissions, reason, mutation route and receipt stay intact.
- If the current data cannot identify an item, the UI says context is unavailable and prevents a blind mutation. Record the missing capability in FEAT-1-REMAINING.md with the current frontend behavior; do not claim the moderation journey reaches 18/20 until the context path is demonstrated.

**Proof:** form interaction/payload tests; wrong-ID/unknown-context moderation tests; screenshot of confirmation with real fixture context; denied permission case.

## Q13 — Tournament task-first layout and honest preview facts

**Scope:** U01, U26. Preserve Tournament discovery structure, wall preview art, existing route and source-state behavior.

**Files likely touched:** src/features/tournament/TournamentPage.tsx; DashboardTab.tsx; BracketTab.tsx; manage/ManageTab.tsx; src/features/home/HomePage.tsx; TournamentPreview.tsx if needed; scoped CSS.

**Acceptance:**

- On working routes, a compact identity/status strip and local navigation precede route-specific content; full Details/Entry facts remain reachable in Overview/disclosure.
- At 1440×900 the first useful match/task row and primary action are visible initially. At 390×844 the bracket entry point/first useful match is reached without the former full repeated preamble.
- Organizer guidance uses organizer context, not a player-only squad instruction.
- Preview labels “Public” as Visibility. Phase is shown only when current data supplies it.
- Restricted/Guest/unknown-source cases do not reveal private data or fabricate facts.

**Proof:** existing Tournament navigation/source tests plus route-specific behavior case and measured screenshots for Desktop/Mobile.

## Q14 — Home density without losing equal peers

**Scope:** U11. This ticket explicitly proposes replacing the earlier fixed-320px short/empty-state rule; equal desktop peer height remains mandatory.

**Files likely touched:** src/features/home/HomeWorkspace.tsx; HomeTaskPanel.tsx; NextMatchPanel.tsx; src/styles/prototype.css or one feature-scoped stylesheet.

**Acceptance:**

- Needs you and Next match have equal outer height on the same Desktop state. A one-task/empty-next-match fixture uses a shared compact body; a long task queue is bounded and scrollable.
- Task count remains prominent and accurate. Tournament cards appear materially sooner in the sparse fixture than the current near-y880 sample.
- Loading/error/denied states remain distinct. Mobile peers stack with content-appropriate height.

**Proof:** existing Home source/queue tests, long-list and sparse rendered measurements at 1280/1440 and 390px.

## Q15 — Referee work queue, result entry and bounded regions

**Scope:** U02, U27, U28. Keep all assignments, drafts, result payloads and review confirmations.

**Files likely touched:** src/features/matches/MatchesPage.tsx; src/features/match/ResultForm.tsx; StatSheet.tsx; src/styles/prototype.css; affected Organizer/Admin bounded panel CSS only if a shared rule is safe.

**Acceptance:**

- A fixture with 30 tasks in one category and three empty categories devotes working width to the selected tasks. Recommended counted category tabs and two desktop card columns, one mobile column.
- Each task card keeps its Record result action visible without an inner card scroll. Long names wrap. The queue remains bounded and reveals further items.
- Result entry leads with score and required fields. Team/player filters or optional-stat disclosure retain drafts and expose validation errors at the correct field.
- Keyboard reaches every task and scroll region; action footers remain outside scrolling content.

**Proof:** 30-task fixture, 48-player fixture, filtering/draft/validation behavior tests, keyboard and screenshot measurements.

## Q16 — Organizer request and referee coverage

**Scope:** U14, U15. No mutation or setup-rule changes.

**Files likely touched:** src/features/request/RequestPage.tsx; src/features/tournament/manage/RefereePanel.tsx; local CSS and existing tests.

**Acceptance:**

- Request is grouped as Tournament/Schedule/Eligibility with concise consequence-oriented hints and a review summary. All current required values and payload fields remain.
- Retryable failure retains request draft; server validation remains authoritative.
- “6 accepted · 2 required per match” or equivalent separates accepted people from per-match requirement. Show assignment coverage only when existing match assignment data establishes it; do not infer coverage from the invitation count.

**Proof:** Request submit/failure test, referee-count fixture, both-theme Desktop screenshots.

## Q17 — Inbox decisions and Search navigation

**Scope:** U08, U18. Keep per-source failure and notification state behavior.

**Files likely touched:** src/features/inbox/InboxPage.tsx; BackendInbox.tsx; src/features/search/SearchPage.tsx; search-inbox-workspace.css; existing tests.

**Acceptance:**

- Pending invitations/referee decisions appear before notification history or in a first selected Needs action tab with visible count. One pending action is visible in the initial Desktop viewport.
- Mark all read changes notifications only, not request status. Action failure retains the pending item.
- Search exposes All/Tournaments/Teams/Players counts or anchors; partial failure preserves available categories and category retry. An unknown sport is described as unavailable, not as a technical “Sport #1” label unless that ID is truly the only usable identifier.

**Proof:** populated/empty/partial-error fixtures, notification-action regression tests and full-page screenshots.

## Q18 — Equal Team management with useful density

**Scope:** U12. Retain approved Members/Invites/Manage top tabs and equal Desktop frame dimensions.

**Files likely touched:** src/features/team/TeamPage.tsx; TeamManage.tsx; scoped Team CSS in prototype.css; existing Team tests.

**Acceptance:**

- The three selected panels remain equal-sized at the same Desktop viewport; only one is visible/focusable at a time.
- Manage actions are top-aligned in a concise group, with destructive action separated. No filler statistics.
- Tab switching retains drafts and role loss removes private controls; mobile height can follow content.

**Proof:** Team role/tab/draft tests plus computed dimensions and Desktop/Mobile screenshots.

## Q19 — Admin workspace density

**Scope:** U19. Q12 owns feedback moderation; this ticket owns only layout and repeated explanatory chrome.

**Files likely touched:** src/features/admin/AdminPage.tsx; AdminGovernanceTab.tsx; AdminUsersTab.tsx; relevant scoped CSS and existing tests.

**Acceptance:**

- Grouped Admin navigation is compact enough that the selected task group and an actionable item appear in the first Desktop viewport.
- Shared action consequence is explained once, with per-item identity and review still visible.
- Role/scope denial remains explicit; no unguarded bulk-approve path is introduced.

**Proof:** scoped admin fixtures, approval/rejection/denial regression tests, Desktop screenshots.

## Q20 — Mobile shell and immediate task access

**Scope:** U10. Keep 232px Desktop sidebar; preserve Scan trigger behavior and route access.

**Files likely touched:** src/components/layout/Shell.tsx; navSection.ts only if route semantics change; src/styles/prototype.css; existing Shell/Scan tests.

**Acceptance:**

- At 390px, shell before main content targets <=120px, with direct Scan access. Profile holds account/logout; navigation, search and current section remain reachable.
- 320px reflow, long account name, both themes, enlarged text, keyboard and touch are checked; no page-level overflow.
- Secure-origin camera and insecure-origin file-capture branches keep their current supported behavior. iPhone safe area/capture is confirmed on a physical device before closing device acceptance.

**Proof:** Shell route/access tests, rendered 390/320 screenshots, physical iPhone note; if device unavailable, keep device row unverified.

## Q21 — Truthful mock Profile, MVP and Watch

**Scope:** U17, U24, U25. Mock fidelity and existing empty-state navigation only.

**Files likely touched:** the mock branch in src/features/profile/ProfilePage.tsx using its existing careerByTournament rows; src/features/mvp/MvpPage.tsx; src/features/watch/WatchPage.tsx; feature tests. Leave src/api/user.ts and its mock API contract unchanged.

**Acceptance:**

- Mock Profile shows confirmed played/won totals derived from the same career rows visible below. Show a title total only where the tournament finish value establishes it; otherwise mark that fact unavailable.
- MVP mock calls the existing real model “Match MVP” and shows correct eligible/closed meaning. Active voting remains separately verified.
- Watch unavailable/empty state has a working Open match or View bracket path; no unsupported video is implied.

**Proof:** mock/live-contract parity tests and screenshots of the three states.

## Q22 — Route loading and bundle evidence

**Scope:** U23. Current static route imports are the target; keep the scanner library lazy.

**Files likely touched:** src/App.tsx; src/components/layout/ErrorBoundary.tsx only if existing handling does not recover a chunk error; route tests; no API layer changes.

**Acceptance:**

- Major Admin/Organizer/advanced Match code is loaded at its route boundary with a stable named loading state. Navigation, permission gate and error recovery still work.
- Equivalent production build shows an improved initial chunk against the captured baseline; proposed main JS <=200 kB gzip. Record all chunk sizes, including newly split chunks, without pretending bytes alone prove faster user experience.
- Cold-load comparison and chunk-failure behavior are checked on the same machine/conditions; no LCP/INP claim without measurement.

**Proof:** build manifest comparison, route-loading/failure tests, Browser navigation checks.

## Q23 — Cross-role quality acceptance and scorecards

**Scope:** every U01–U28; quality gate, no hidden feature implementation. Depends on Q10–Q22.

**Files likely touched:** docs/reviews/new dated acceptance record, spec/ticket/plan completion ledgers; no product source unless a newly discovered regression receives its own explicit fix ticket.

**Acceptance:**

- Fresh baseline and post-change /20 scorecard for every named surface and applicable state. Each accepted surface >=18/20, every dimension >=3, no open P1; technical >=18/20 separately.
- Desktop 1280×800 and 1440×900 in dark/light, long/empty/error/denied/permission cases, full route/role matrix. Mobile 390×844 and 320px/reflow and physical-device scan after Desktop acceptance.
- TypeScript, lint, full suite and build pass. Behavior tests cover changed contracts; visual inspection establishes layout. No inherited uncommitted source change is silently discarded.
- Missing backend/device evidence is marked unverified, with the relevant score withheld rather than rounded up. Final review records defects, fixes and remaining limits.

## Full issue ownership check

| Issue | Ticket | Issue | Ticket | Issue | Ticket | Issue | Ticket |
|---|---|---|---|---|---|---|---|
| U01 | Q13 | U02 | Q15 | U03 | Q11 | U04 | Q11 |
| U05 | Q11 | U06 | Q10 | U07 | Q12 | U08 | Q17 |
| U09 | Q12 | U10 | Q20 | U11 | Q14 | U12 | Q18 |
| U13 | Q10 | U14 | Q16 | U15 | Q16 | U16 | Q11 |
| U17 | Q21 | U18 | Q17 | U19 | Q19 | U20 | Q10 |
| U21 | Q10 | U22 | Q10 | U23 | Q22 | U24 | Q21 |
| U25 | Q21 | U26 | Q13 | U27 | Q15 | U28 | Q15 |

Execution order recommendation: Q10, then Q11–Q12 and Desktop workflow Q13–Q19, then Q20 Mobile, Q21–Q22 fidelity/runtime, and Q23 acceptance. Q21/Q22 can be prepared independently of desktop layout once the shared code baseline is recorded. This is an ordering proposal, not authorization for orchestration or parallel workers.
