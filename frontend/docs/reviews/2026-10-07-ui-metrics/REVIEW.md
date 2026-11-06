⚠️ DEGRADED: single-context (review workers hit the account usage limit; root completed both assessments from their captured evidence)

# LTMS — UI/UX scorecard and remediation matrix

Date: 2026-10-07. Target: src/App.tsx and its routed application surfaces. Branch reviewed: ltms-desktop-ux. Scope: current working tree, including existing uncommitted work; this is not a review of only the last commit.

## Verdict

The approved Minimal Street identity is recognizable and worth keeping: dark plum, cream, teal, angular frames, condensed athletic headings, team-role colors, and the wall-poster Tournament preview. Brand specificity scores **8/10**. Desktop visual coherence scores **7/10**.

Usability is less mature: repeated context pushes the actual task down, work queues use space inefficiently, several actions do not communicate their destination, and error recovery is uneven. Final Nielsen score: **23/40 (57.5%, approximately 58/100)**. Technical quality: **12/20**. These are expert assessment scores, not completion percentages, measured task success rates, or a production-readiness certification. Do not average these unlike scales into a single product KPI.

**Finding register: 28 findings — 0 observed P0, 9 P1, 19 P2.** P0 means a critical observed blocker; P1 means material friction, error risk, or accessibility failure in a primary workflow; P2 means meaningful improvement with an available workaround. No observed P0 is not a guarantee that untested states contain none. No application, API, backend, DTO, permission, or payload changes were made for this review.

## Method and coverage

- Impeccable critique and audit workflow, using the project's PRODUCT.md, DESIGN.md and frontend instructions.
- Independent A, B and workflow workers were started. All hit the account usage limit before completing their written assessments. They had already captured substantial evidence.
- Root recorded Assessment A before reading the detector output, then completed Assessment B and the workflow synthesis. This preserves the order of observation, but does not constitute a completed independent dual-agent verdict.
- 87 PNG captures across desktop, mobile, themes, overlays and error states. This is a capture count, not 87 unique pages or 87 independently completed user journeys.
- 20 axe/DOM checks: Home, Teams, Schedule, Profile and Login × 1440×900/390×844 × dark/light.
- Additional 1280px team-leader samples; organizer, referee, admin, registration, inbox, search, profile, Player, MVP and Watch fixtures.
- Browser-denied camera and invalid QR tests in isolated contexts; Scan Escape/focus-return behavior checked.
- Existing mock app and intercepted response fixtures only. Some fixtures render real-mode components without contacting a live backend.
- No physical iPhone, live permission/server integration, exhaustive keyboard/screen-reader run, 320px/400% reflow acceptance, field performance study, or moderated user study. States not exercised are marked below.
- Browser inspection was headless. No visible Chrome window was opened.

Evidence: [Assessment A](assessment-a.md), [Assessment B](assessment-b.md), [A measurements](a/measures.json), [browser checks](b/browser-results.json), [workflow observations](workflow/observations.json), [Scan evidence](scan/evidence.json).

## Scoring

### Nielsen heuristics

Scale: 0 unusable/absent, 1 substantial problems, 2 usable with significant friction, 3 generally sound with gaps, 4 consistently strong in the sampled scope. All ten heuristics apply.

| Heuristic | /4 | Reason |
|---|---:|---|
| Visibility of system status | 3 | Status and counts exist; Scan shows Starting camera after failure. |
| Match with real-world language | 2 | Team/Squad, leader/captain, filter terminology and status meaning vary. |
| User control and freedom | 3 | Back, Cancel, filters, Escape and focus restoration work in sampled flows. |
| Consistency and standards | 2 | Strong palette; headings, tab semantics and action wording drift. |
| Error prevention | 2 | Register invents personal defaults; feedback moderation lacks target context. |
| Recognition rather than recall | 2 | Visible navigation helps, but deep context and raw IDs demand memory. |
| Flexibility and efficiency | 2 | Useful filters and bounded queues; unnecessary scrolling and narrow work cards. |
| Aesthetic and minimalist design | 2 | Distinct style; too much repeated context and empty fixed-height space. |
| Error recognition and recovery | 3 | Partial failures retain useful content; Scan and profile retry paths need work. |
| Help and documentation | 2 | Inline help exists but is verbose, inconsistent and sometimes technical. |
| **Total** | **23/40** | **Usable, with significant refinement required.** |

Assessment A initially recorded 24/40. Expanded Register/Admin evidence lowered Error prevention from 3 to 2. The final app-wide score is 23/40, not a measured regression between builds.

Reference: [Nielsen's ten usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

### Technical assessment

| Dimension | /4 | Main evidence |
|---|---:|---|
| Accessibility | 2 | Light Schedule contrast failure, empty column headers, weak asynchronous Scan error announcement. |
| Performance | 2 | Main JS approximately 944.8 kB raw; all route imports static. No measured LCP/INP. |
| Responsive layout | 2 | No sampled horizontal page overflow; mobile shell and sparse panels are too tall. |
| Theming | 3 | Shared tokens work broadly; light table-header color pair fails. |
| Implementation integrity | 3 | Reusable components and source-state handling; typography scale and semantics need consistency. |
| **Total** | **12/20** | **Fix verified issues before describing the UI as polished.** |

### Per-surface matrix

Scores are expert judgment, not averages of automated warnings. 5 = workable with significant friction; 7 = sound with clear gaps; 9 = highly polished. A dash means no sufficiently broad mobile review for a score.

| Surface | Desktop /10 | Mobile /10 | Findings / principal recommendation |
|---|---:|---:|---|
| App shell/navigation | 7 | 4 | U10, U20, U22: compact mobile shell, semantic navigation, comfortable controls |
| Home | 6 | 4 | U11: equal but denser paired panels |
| Tournament discovery | 7 | 6 | U13, U21: filter hierarchy, readable status and labels |
| Tournament preview popup | 8 | 7 | U26: preserve wall identity; distinguish visibility from phase |
| Teams list | 7 | 6 | U13, U21: clarify readiness and roles; retain colored frames |
| Leader Team management | 6 | — | U12: equal tab frames with useful, compact action placement |
| Public Team/Player | 7 | — | U13, U21, U28: readable terminology and long-table hierarchy |
| Tournament/Bracket | 6 | 4 | U01: put bracket before repeated generic details |
| Community | 6 | — | U01, U21: reduce inherited preamble and repeated heading emphasis |
| Organizer request | 6 | — | U15: three clear sections and concise rules |
| Organizer management | 5 | — | U01, U14: task-first layout and truthful referee counts |
| Matches list | 7 | — | U13, U21, U28: consistent grouping and concise metadata |
| Referee work queue | 5 | — | U02: selected-state queue with room for real work |
| Match detail/Next action | 6 | 5 | U03: exact action label and destination |
| Result entry | 6 | — | U27: score-first task, manageable roster/stat columns |
| Dispute review | 7 | — | Preserve clear recorded/claimed comparison; reduce preceding context |
| Check-in roster | 6 | 5 | Personal action/result first; simplify method labels |
| Scan dialog | 5 | 5 | U04, U05: clear failure state and visible recovery controls |
| Admin requests/directory | 6 | — | U19, U28: denser navigation and bounded work rows |
| Admin rights/transfer/audit | 6 | — | U13, U19: entity context and shorter repeated explanations |
| Admin feedback moderation | 4 | — | U09: see target content before mutation |
| Search | 7 | — | U18: category navigation; preserve partial-source recovery |
| Inbox | 5 | — | U08: pending decisions before announcement history |
| Login | 7 | 7 | Keep simple form; four sampled axe checks clean |
| Register | 6 | — | U07: require deliberate personal values |
| Profile | 6 | 5 | U16, U17: actionable retry; reconcile preview totals |
| MVP | 6* | — | U24: closed mock state reviewed; active voting not verified |
| Watch | 5* | — | U25: mock empty state viewed; real unavailable branch inspected in source |

## Measured layout and browser indicators

| Indicator | Observed | Interpretation / proposed target |
|---|---|---|
| Home desktop, Tournament heading | y562 at 1440×900; first cards near y880 | Top panels and filters consume nearly the initial viewport. |
| Home mobile, Tournament heading | y1208 at 390×844 | Compact shell and density-aware cards should materially shorten the route to discovery. |
| Mobile Home first heading | y341; shell about 314px tall | Proposed shell budget <=120px before main content. |
| Bracket canvas, desktop | y857 at 1440×900 | Proposed: first useful match visible without page scrolling. |
| Bracket canvas, mobile | y1689 at 390×844 | Proposed: bracket entry point/first useful match within initial viewport, allowing appropriate bracket navigation. |
| Home Needs you/Next match | Both have fixed 320px bodies | Preserve equal heights on desktop, but allow a shared compact sparse-state height. |
| Light Schedule headers | 3.14:1, 13px bold; six cells, reproduced at both widths | Ordinary text requires >=4.5:1; use a compatible foreground/background token pair. |
| Horizontal page overflow | None in 20 completed B checks | Positive evidence for those combinations only; not proof of all reflow requirements. |
| Controls under 44px | Home 7, Teams 13, Schedule 27, Profile 6, Login 0 in sampled checks | Comfort candidates, not automatic conformance failures. No sampled controls below 24px. |
| Main JavaScript | 944,829 B raw; 269.45 kB gzip in preceding build output | Route splitting is warranted; speed impact still requires measurement. |
| Scan denied-camera state | Camera unavailable and Starting camera shown together | Confirmed state precedence defect. |

Coordinates are document-relative, from the sampled viewport and data. They are not universal values across all datasets.

[W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) specifies 4.5:1 for ordinary text and 3:1 for qualifying large text. [Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) is 24×24 CSS pixels or applicable exceptions; 44×44 here is a design comfort target. [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) requires separate verification beyond a 390px screenshot.

## Detailed finding register

### U01 · P1 · Tournament/Organizer pages bury their actual task

**Evidence:** Bracket canvas starts at y857 desktop and y1689 mobile. General Details/Entry panels repeat before Bracket, Community and organizer work. Organizer context also includes player-oriented squad guidance. [Desktop Bracket](a/u-play-_t_t_fb_bracket-1440-dark.png), [mobile Bracket](a/u-play-_t_t_fb_bracket-390-dark.png), [organizer progress](workflow/organizer-progress.png).

**Fix:** Use one compact tournament identity/current-state row, followed immediately by route tabs. Keep full Details/Entry in Overview or a disclosure. Show role-appropriate next steps in work routes. Place organizer queue controls and task content before secondary background information.

**Acceptance:** At 1440×900, the first useful task row/match and its primary action are visible initially. At 390×844 the bracket entry point/first match is reachable without scrolling through full repeated details. Overview retains meaningful facts. Existing data access and role rules remain authoritative.

### U02 · P1 · Referee queue allocates most width to empty categories

**Evidence:** A 30-task fixture places all tasks in one narrow column while three peer columns are empty. Long names and dates wrap; one card exceeds the useful bounded area. [Queue](workflow/referee-queue.png). Source: MatchesPage.tsx; prototype.css rules refgrid and match-work-bucket.

**Fix:** Show counted categories as tabs/chips and render the active category as two compact card columns on desktop, one on mobile. Alternatively collapse empty categories. Retain equal card sizing within a view, bounded lists, clear team/date metadata and an always-visible Record result action.

**Acceptance:** With 30 tasks and three empty categories, useful width goes to actual work. Proposed 1440px design target: four useful task cards visible in the main working area; primary buttons do not require scrolling inside individual cards. Switching category retains predictable scroll/focus behavior.

### U03 · P1 · Next action message and button disagree

**Evidence:** Settled match guidance says View History, while the button says Open overview and navigates to overview. Source: MatchNextStep.tsx, lines 18/27/43. Browser click confirmed the destination. [Match detail](a/u-play-_m_m_127-1440-dark.png).

**Fix:** Derive label and destination together from match state and role: View history, Record result, Review dispute, Open check-in. Only offer permitted actions and actual existing routes/sections.

**Acceptance:** For each supported state/role combination, guidance, button text and destination agree. View history opens History. Route transitions move focus to the destination heading or relevant content.

### U04 · P1 · Scan failure conflicts with the live status

**Evidence:** Browser camera denial displays Camera unavailable and Starting camera simultaneously. Invalid QR failure also leaves Starting camera as the status. The error is not an explicit live alert. [Denied camera](scan/scan-denied-1440-dark.png), [invalid QR](scan/scan-invalid-390-light.png). Source: CaptureModals.tsx 155–168 and shared Banner.

**Fix:** Define mutually exclusive starting, ready, denied, decoding, invalid and success states. Give the error precedence over loading. Explain the next permitted step: allow camera and retry, choose a photo where supported, or use an existing alternative. Announce the asynchronous failure locally; associate field errors with their controls.

**Acceptance:** Denial never leaves a loading announcement. Keyboard/screen-reader users receive one meaningful failure notification and can reach recovery. Retry works after permissions change. Invalid codes preserve editable input. Do not turn every passive Banner into an assertive alert.

### U05 · P2 · Scan dialog spends too much space on a failed camera

**Evidence:** Dialog approximately 620×774 desktop and 358×726 mobile; the large empty camera region pushes footer actions out of the initial visible area. Modal scrolling makes them reachable, so this is not a demonstrated trap. [Mobile camera denial](scan/scan-denied-390-light.png).

**Fix:** Collapse failed camera preview into a concise error block. Use a separately scrolling body and visible footer. Keep the primary scan path clear, with secondary manual entry behind an explicit control if appropriate.

**Acceptance:** At 360/390px and enlarged text, Cancel and recovery remain reachable without searching through a blank preview. Escape closes and restores focus. Do not treat demo-only controls as production defects.

### U06 · P1 · Light Schedule table headers fail text contrast

**Evidence:** Six header cells, 13px bold, foreground #1e170f on #12764e, measured 3.14:1 at both sampled widths. Source: prototype.css line 316, global th styling. [Light Schedule](b/schedule-1440-light.png), [automated evidence](b/browser-results.json).

**Fix:** Use the appropriate accent foreground token on the teal fill, or a neutral header surface. Verify actual computed colors, including relevant hover/focus/selected states.

**Acceptance:** Ordinary table header text reaches >=4.5:1 in light and dark themes. All table variants using the shared rule are checked, not just one screenshot.

### U07 · P1 · Register silently chooses personal information

**Evidence:** Register initializes gender to male, birth date to 2000-01-01, faculty/department IDs to 1 and year to 1. Source: RegisterPage.tsx 16–25. [Register](workflow/register.png). This creates error risk; no real account was submitted during review.

**Fix:** Start personal fields unselected and ask for deliberate input. Validate dependent faculty/department selections. Local draft state may hold empty values, while validated submission preserves the existing API schema.

**Acceptance:** Untouched arbitrary personal values cannot be submitted as if chosen by the user. Required omissions are identified at their fields; dependent department choices cannot become stale. No new backend contract is required.

### U08 · P1 · Inbox places actionable requests below notification history

**Evidence:** A 2897px fixture puts invitations/referee decisions after grouped updates and their pagination. Source: InboxPage.tsx 101–127 before ActionRequests. [Inbox](workflow/inbox.png).

**Fix:** Prioritize Needs action (count), then Updates. Use a bounded action list or tabs, show recognizable match/team context, and order by meaningful urgency only where genuine deadlines exist.

**Acceptance:** At least one pending action is visible in the initial desktop viewport. Mark all read affects notification read state, not request decisions. Actions retain their context and pending state after failures.

### U09 · P1 · Admin feedback moderation asks for a raw ID without showing the target

**Evidence:** Feedback ID plus Remove/Restore controls, without target content preview or a confirmation identifying that content. Source: AdminFeedbackTab.tsx 22–28. [Feedback moderation](workflow/admin-feedback.png). No destructive action was executed. Other admin grants have a review step; this finding does not generalize to every admin mutation.

**Fix:** Start moderation from a selected comment/review where possible. Carry ID, author, tournament and excerpt into a confirmation. Use existing context and endpoints. If no existing lookup is available, design a contextual entry point or explicitly identify the missing dependency; do not invent an API.

**Acceptance:** The moderator can identify the intended target before mutation. Missing target context is made explicit instead of implying a verified match. Existing permission checks, failure feedback and audit receipts remain intact.

### U10 · P1 · Mobile shell consumes too much of the first screen

**Evidence:** At 390px, navigation/account/logout/search/Scan occupy about 314px before content. Home heading begins at y341. [Mobile Home](a/u-play-_-390-dark.png).

**Fix:** Use a compact header with a drawer or focused mobile navigation. Put account details/logout under Profile. Keep Scan discoverable as a direct action. Retain the desktop sidebar.

**Acceptance:** Proposed main-content shell budget <=120px at 390px. Navigation, current location, search and Scan remain available with keyboard/touch support. Validate actual iPhone safe areas and browser chrome separately.

### U11 · P2 · Home's equal panels stay large even when almost empty

**Evidence:** Needs you and Next match use fixed 320px bodies, even with one task and no next match; first tournament cards begin near y880 desktop. Source: prototype.css 673/686. [Desktop Home](a/u-play-_-1440-dark.png).

**Fix:** Preserve the requested equal-height desktop pair. Select a shared compact height for sparse/empty data, and a bounded taller size with scrolling for long queues. Stack with natural heights on mobile. Keep the prominent task count.

**Acceptance:** One-task/empty-next-match state uses a proposed shared 180–220px body rather than 320px. Large task counts do not push Tournament progressively down the page. Empty-state actions sit close to their explanation.

### U12 · P2 · Team Manage preserves equality through excessive blank space

**Evidence:** The equal tab frame contains only a few actions and a disabled Disband control. [Leader Manage](a/u-lead-_team_t_byt-1280-dark-Manage.png).

**Fix:** Retain consistent desktop frame dimensions across Members/Invites/Manage. Align content at the top, group routine actions into compact rows, and separate the destructive area with concise context. Do not add decorative statistics to fill space.

**Acceptance:** All three tab frames remain equal at the same desktop viewport. The first useful action is obvious without scanning a large blank panel; mobile uses appropriate natural height.

### U13 · P2 · Terms and statuses require translation in the user's head

**Evidence:** Team/Squad, leader/captain, Hard filter/Soft filter, onsite/On-site and varying date/status formats appear across surfaces.

**Fix:** Create a concise English UI vocabulary: Team, Team leader, Entry rules, Entry notes, On-site. Separate approval, visibility and tournament phase. Standardize readable dates/time-zone context without renaming API identifiers or erasing genuine domain distinctions.

**Acceptance:** The same concept uses one visible term throughout. Eligibility wording describes the relevant tournament rather than implying every ready team is universally eligible. Dates are unambiguous in scheduling contexts.

### U14 · P2 · Referee count compares unlike quantities

**Evidence:** 6 of 2 accepted in the fixture. Source: RefereePanel.tsx 221. [Organizer referees](workflow/organizer-referees.png).

**Fix:** Show 6 accepted · 2 required per match. Separate invitation responses from match assignment coverage.

**Acceptance:** No accepted-person total is presented as a misleading percentage against a per-match requirement. Missing coverage remains recognizable with existing data.

### U15 · P2 · Tournament request is long and uses implementation-oriented help

**Evidence:** A 1930px form with repeated rule paragraphs and multiple eligibility choices. [Request form](workflow/organizer-request.png).

**Fix:** Group into Tournament, Schedule and Eligibility. Use concise hints explaining user consequences; disclose detailed rules when needed. Add a compact review summary and clear submit action. Avoid introducing a wizard unless research establishes the need.

**Acceptance:** All existing required rules and submitted values are preserved. Users can identify missing information and review the request without rereading repeated server terminology. Source failures preserve entered data.

### U16 · P2 · Profile failure tells the user to retry but provides no retry action

**Evidence:** Empty state says Retry when server is ready. Source: ProfilePage.tsx 125. [Stats failure](workflow/profile-failed.png).

**Fix:** Add Retry stats using the existing query refetch, with local pending/result feedback. Keep account and successfully loaded sections available.

**Acceptance:** Failed stats can be retried without a full page reload. Unknown stats never become misleading zero values.

### U17 · P2 · Mock Profile summary contradicts the visible career data

**Evidence:** Native mock Profile shows zero played/won/titles while career rows show three played, two won and one championship. The intercepted real-mode fixture is consistent. [Mock Profile](a/u-play-_me-1440-dark.png).

**Fix:** Align preview data and summaries within the same documented scope, or explicitly label different scopes/unavailable data. Do not sum incomparable sport metrics or infer backend defects.

**Acceptance:** Mock summary and same-scope career data agree. This is a preview-data correction unless separately reproduced against the backend.

### U18 · P2 · Search makes users scroll past unrelated categories

**Evidence:** 19 results across a 2165px full fixture; partial failure retains usable results and retry, which is good. [Search](workflow/search.png), [partial source failure](workflow/search-partial.png).

**Fix:** Add All/Tournaments/Teams/Players category counts or in-page category links. Keep the query visible. Replace technical Sport #1 fallback with accurate user-facing unavailable metadata when a name cannot be resolved.

**Acceptance:** Users can reach a known result type without traversing every preceding group. Partial failures preserve other results and expose category-specific retry.

### U19 · P2 · Admin navigation and repeated explanations crowd the task area

**Evidence:** Three groups of navigation plus repeated explanatory text above/inside request cards. [Admin requests](workflow/admin-requests.png), [rights](workflow/admin-scopes.png).

**Fix:** Compact the grouped navigation and explain common action consequences once, retaining item-specific review context. Keep equal cards, useful row metadata and stable action footers.

**Acceptance:** At 1440×900 the selected task group is visible with actionable items. Permission grouping and existing confirmation flows remain recognizable. Avoid unguarded bulk-approval shortcuts.

### U20 · P2 · Some controls communicate state visually but not semantically

**Evidence:** Two empty Schedule th elements; shell search/avatar outside landmarks flagged as best practice. Shared Tabs use visual on classes without a selected-state contract.

**Fix:** Give action columns accessible names; use header/search landmarks. For route navigation use links and aria-current. For in-place tabs implement aria-selected and the complete expected keyboard pattern, rather than adding isolated roles.

**Acceptance:** A keyboard/screen-reader user can identify the current route/tab and table action column. Focus remains visible and stable. Distinguish best-practice warnings from normative conformance failures.

### U21 · P2 · Type and emphasis scales drift between working surfaces

**Evidence:** Home/Teams/Check-in/Tournament headings vary roughly 36/48/28/60px, with inconsistent tab and action-heading treatments. Variation can be intentional, but the roles are not consistently expressed.

**Fix:** Define display, page, section, body and metadata roles. Preserve expressive condensed type for display, use readable body type for dense work, and reduce heavy accents on routine tables. Suggested working scale: 14–16px body, 12–13px secondary metadata where readable.

**Acceptance:** Comparable heading/button roles look consistent; intentionally prominent Tournament presentation stays distinct. No necessary content becomes tiny solely to fit a frame.

### U22 · P2 · Several mobile controls are less comfortable than the desired touch target

**Evidence:** Under-44px counts: Home 7, Teams 13, Schedule 27, Profile 6, Login 0. No sampled controls below 24px. These are candidate improvements, not equivalent numbers of WCAG failures.

**Fix:** Increase interactive padding/spacing on compact chips, icon controls and avatar where needed, preserving reasonable visible icon sizes.

**Acceptance:** Primary touch actions target approximately 44×44px where practical; adjacent actions are distinguishable. Check real touch interactions, enlarged text and wrapping before claiming mobile readiness.

### U23 · P2 · Static page imports inflate the initial JavaScript bundle

**Evidence:** Main JS 944,829 B raw, previous build gzip 269.45 kB. App.tsx statically imports all pages. ZXing already loads separately, approximately 477.6 kB raw/125.22 kB gzip.

**Fix:** Add route-level lazy boundaries for admin, organizer and advanced match workflows, with stable loading frames and error recovery. Keep the scanner library lazy.

**Acceptance:** Compare equivalent production builds and cold loads; proposed initial-JS budget <=200 kB gzip is a project target, not a universal rule. Verify route navigation and chunk-load failure recovery. No claim of currently measured poor LCP/INP is made.

### U24 · P2 · MVP preview describes a different award model

**Evidence:** Native mock view says tournament award, not per-match; real-mode code models per-match voting and its eligibility window. [MVP](extra/mvp.png), source MvpPage.tsx.

**Fix:** Align mock labels and scenarios with the existing live contract: match-specific scope, eligibility and voting-closed state. Do not change backend voting rules.

**Acceptance:** Preview and real-mode descriptions agree about what is voted on. Test active, ineligible and closed states separately before claiming full voting UX coverage.

### U25 · P2 · Watch empty state describes a next step without offering it

**Evidence:** No video available plus instructions to open a match; mock replay list contains no actual replay links. Real unavailable branch similarly directs the user to the bracket in prose. [Watch](extra/watch.png), source WatchPage.tsx.

**Fix:** Offer Open match or View bracket using existing navigation. Name lists accurately when recordings do not exist; keep unavailable-stream information honest.

**Acceptance:** The empty view has a working, relevant next action. No promise of streaming functionality is introduced without support.

### U26 · P2 · Tournament popup calls visibility a competition status

**Evidence:** A fact labeled Status contains Public. The wall-poster presentation itself is the strongest visual surface. [Preview](a/u-play-__preview_t_fb-1440-dark.png).

**Fix:** Label Public as Visibility and show competition phase separately when supplied. Match date labels to their actual meaning; do not invent live status from insufficient data.

**Acceptance:** A user can distinguish who may view the tournament from whether it is upcoming, active or finished. Preserve the approved art direction and clear navigation.

### U27 · P2 · Result entry exposes too much roster/stat detail at once

**Evidence:** Ten stat columns and a long 48-player fixture demand broad scanning. Player names already remain pinned and should stay that way. [Result entry](workflow/referee-result.png).

**Fix:** Put match score and completion requirements first; add team/player filters and optional-stat disclosure. Keep required stat fields and their errors reachable, drafts intact across filters, and any completion indicator derived from real validation.

**Acceptance:** Filtering never loses entered results. Missing required data takes the user to the correct player/field. Existing review/confirmation steps remain; do not claim they are absent.

### U28 · P2 · Bounded panels need clearer continuation cues

**Evidence:** Referee/admin/table regions cut off rows at their boundaries; platform-hidden scrollbars make continuation less obvious. This is not a recommendation to remove bounded queues.

**Fix:** Use sticky section headers, count labels, a subtle overflow cue and action footers outside the scrolling body. Give keyboard users a meaningful focusable region where appropriate; avoid nested scrolling inside each card.

**Acceptance:** Long datasets retain a bounded page layout, users can tell more items exist, all items/actions remain keyboard-reachable, and individual task cards do not create competing scroll regions.

## Cognitive load, emotional journey and persona risks

Checklist: five weaknesses — single focus, visual hierarchy, visible choice grouping, memory burden and progressive disclosure. Grouping/chunking inside working panels and single-purpose dialogs are strengths. The Home combination of six sports, four stages and three relation filters illustrates competing decisions; it does not establish a universal rule that menus may never exceed four choices.

Emotional journey: recognizable sporting identity at entry, friction when users scroll through repeated context to reach work, uncertainty when Scan fails or a primary action leads somewhere different from its promise.

| Persona | Main risk | Desired result |
|---|---|---|
| New Player | Team readiness, eligibility, visibility and competition phase are easy to confuse | Know whether and how to join without interpreting domain jargon |
| Team leader | Sparse management panels and buried pending requests | See the next decision and keep stable tab layout |
| Referee | 30 tasks confined to one narrow column; score sheet is dense | Open the correct task and finish it with clear progress |
| Organizer | Generic context precedes every working view; counts compare unlike units | Understand actual progress and assignment coverage |
| Admin | Raw-ID moderation and repeated explanatory chrome | Identify the exact target and act deliberately |
| Keyboard/low-vision user | Light contrast and unannounced asynchronous failures | Perceive state, focus and recovery without relying on color |
| Mobile Player | Tall shell and sparse blocks consume initial screens | Reach a primary action quickly with comfortable controls |

## Strengths that the next pass should retain

1. Tournament wall-poster identity, condensed display headings, angular shapes and plum/cream/teal palette.
2. Team role colors, strong leader differentiation, equal desktop pairs and three-tab Team management.
3. Bounded queues that prevent unbounded page growth.
4. Partial-search failure keeps successful results; real-mode Profile failure does not replace unknown stats with zero.
5. Dispute review makes recorded versus claimed values recognizable.
6. Visible keyboard focus and tested Scan Escape/focus restoration.
7. No page-level horizontal overflow in the 20 completed technical samples.

## Detector interpretation

The bundled detector reported 175 flags: 167 advisory and 8 warning. Of these, 78 are in the historical Home.prototype.html and 11 are in tests/mocks. The remaining 86 active-source flags are 84 font-size advisories, one radius advisory and one broken-image false positive. The image receives a blob URL through an effect and revokes it on cleanup.

Therefore 175 flags are not 175 established product defects. The confirmed Schedule contrast problem comes from browser evidence. Approved typography, angular corners and restrained shadows are not automatically errors because a generic detector dislikes them.

## Proposed repair sequence

These are proposed work batches, not newly opened tickets and not replacements for existing ticket numbers.

| Batch | Findings | Purpose | Validation gate |
|---|---|---|---|
| R1 — Clear actions and trustworthy input | U03, U04, U05, U06, U07, U09, U14, U16, U26 | Correct action wording, status, personal defaults, moderation context and contrast | State/role checks, camera-denial recovery, deliberate form input, known moderation target, contrast |
| R2 — Desktop work density | U01, U02, U08, U11, U12, U15, U19, U27, U28 | Put useful work within the initial view and retain equal/bounded layouts | Sparse/empty/30-task/long-name fixtures at 1280/1440px; no draft loss |
| R3 — Mobile and shared semantics | U10, U13, U18, U20, U21, U22 | Compact navigation, consistent copy/type and accessible state | 390px plus 320px/reflow checks, keyboard, screen reader, actual iPhone |
| R4 — Preview fidelity and loading | U17, U23, U24, U25 | Honest demo behavior, usable empty states and route loading | Real-contract fixture parity; equivalent bundle/cold-load comparison |

For the smallest useful next pass, prioritize **U01, U02, U03, U04 and U06** for visible desktop usability, while keeping **U07/U09** explicit pre-release error-prevention work. U08 and U10 remain P1 even if scheduled after desktop-first changes.

## Verification boundaries for implementation

- Preserve frontend API adapters, DTOs, payload shapes, endpoints and existing role/permission rules.
- Validate normal, empty, long-list, loading, partial failure, denial and invalid-input states appropriate to each change.
- Check 1280/1440 desktop and the supported mobile breakpoints, both themes, long names and translated/backend-provided content.
- Test purposeful behavior changes (action destination, input validation, draft retention, retry) rather than snapshotting every reversible style change.
- Use actual device checks for camera permission, file capture and iOS safe areas before claiming iPhone support.
- Establish any task-completion-time benchmark with real users; no fabricated time-saving or satisfaction metric is part of this report.

## Files

- This matrix: REVIEW.md
- Design reasoning: assessment-a.md
- Technical evidence interpretation: assessment-b.md
- Raw measurements/captures: a/, b/, workflow/, scan/, extra/
- Reproducible Scan fault test: scan-audit.cjs
