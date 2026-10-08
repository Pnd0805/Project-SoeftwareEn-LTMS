# LTMS Quality 20 — UX/UI improvement specification

Status: Draft for review. Date: 2026-10-07.
Authority: current LTMS Minimal Street design, the 2026-10-07 UI metrics review, and the user's request to bring every area as close to 20 as possible.
Scope: frontend only, across Guest, Player, Team Leader, Organizer, Referee and Admin journeys. Desktop first, then mobile acceptance. This document proposes work; it does not mark implementation complete.

## Intent and current evidence

People should find the next permitted task quickly, understand what an action will do, recover from an error, and read the interface comfortably. The approved identity remains plum/cream/teal, angular 2px corners, calm working controls, colored Team role frames, equal desktop peers, bounded queues, and the wall-poster Tournament preview.

The last review found 28 issues: 9 P1 and 19 P2. Nielsen usability was 23/40; technical UI 12/20. Existing per-surface scores were out of 10, mostly 4–8. They are diagnostic baselines, not measured completion rates. The evidence and U01–U28 register live in the [UI metrics review](../../reviews/2026-10-07-ui-metrics/REVIEW.md).

This program addresses all 28 findings while retaining supported domain behavior. It does not promise a perfect score before the new rubric is independently applied to implemented screens.

## Decision: what “near 20” means

Assumption pending the user's scale answer: use one **20-point rubric per surface**. A surface is a distinct route or task view, scored in a named state and viewport/theme combination. The old /10 scores are not silently doubled into new scores. Establish a fresh /20 baseline before the first implementation slice, then score the same fixtures after each slice.

Five dimensions each score 0–4:

| Dimension | What a 4 requires |
|---|---|
| Task clarity | The current context, next permitted action and destination are obvious; unsupported actions are absent or explained. |
| Information hierarchy and efficiency | The relevant work appears before repeated background; dense/empty/long states remain easy to scan and do not create needless page or nested-card scrolling. |
| State truth and recovery | Loading, empty, denied, error, partial failure, saved and unknown states are distinct; users retain drafts and have a working way forward. |
| Accessibility and control | Keyboard and focus behavior work; status and errors are announced; named controls/semantics and ordinary text contrast meet the accepted checks. |
| Visual and responsive craft | Minimal Street identity is consistent; both themes, supported widths and long content render cleanly; primary touch actions are comfortable. |

Scale within each dimension: 0 absent/unusable; 1 major barrier; 2 usable with material friction; 3 sound with a specific gap; 4 consistently strong across the required samples. Score only from evidence. Unobserved states are marked “unverified”, not assigned 4.

Target for each surface: **at least 18/20**, no dimension below 3, no open P1 for that surface, and no failed hard gate. A score of 20/20 is aspirational and may be awarded only when all five dimensions earn 4 with evidence. Coverage is incomplete if an applicable required state is unverified. Report the worst supported viewport/theme/state score as the surface's release score; include a desktop score separately while mobile is pending. This makes it difficult to hide a weak mobile or error state behind a polished desktop screenshot.

Keep the existing **technical /20** score separate: accessibility, performance, responsive, theming and implementation integrity each /4. Target at least 18/20 with each >=3. Nielsen /40 remains a separate, repeatable expert audit. Do not combine these scales into a fabricated single number.

## Quality gates for every surface

1. Existing API routes, DTOs, payloads, hooks, permission decisions and domain rules remain the authority. Missing capability is named in the UI and logged in FEAT-1-REMAINING.md if a genuine backend dependency is discovered. Do not invent an endpoint or permission.
2. Desktop 1280×800 and 1440×900 in dark/light must pass rendered inspection. Mobile 390×844 and 320px/reflow are the later acceptance phase. An actual iPhone is required to close camera/file capture and safe-area claims.
3. Ordinary text contrast >=4.5:1 on the tested surface. Text never relies on color alone for status. Visible keyboard focus, named controls, meaningful headings, and dialog focus/Escape/return are required.
4. Each touched journey has fixtures for normal, empty, long content, loading, denied or unsupported, and retryable failure as applicable. Partial source failure must retain successful content. A mutation failure must preserve the draft and show its actual outcome.
5. Page-level horizontal overflow is absent; data tables/brackets may scroll within named regions. Bounded queues remain bounded and reveal when more work exists.
6. No visual-only change receives a test that merely repeats CSS values. Test behavioral changes at the component/page seam; inspect layout in a browser.
7. Verification before completion: TypeScript, lint, focused tests, full Vitest suite, production build, route/role matrix, and screenshot/interaction evidence. A task is not closed from source checks alone.

## Approach considered

| Approach | Trade-off | Decision |
|---|---|---|
| Cosmetic polish only | Fast, preserves code, but leaves misleading actions, unsafe defaults and buried work | Reject |
| Task-first frontend refinement using current data and contracts | Addresses confirmed issues, can be verified per journey, preserves backend ownership | **Choose** |
| Replace workflows or add backend capabilities first | Could simplify some Admin data needs, but changes contracts and is outside this frontend brief | Defer unless an explicit dependency is proven |

The selected approach changes presentation and local interaction state. It keeps the existing routes, queries and mutations. Shared semantics/contrast/copy are established first; task-heavy workspaces follow; mobile shell and runtime fidelity close the remaining gaps.

## Required product behavior

### Shared language, semantics and controls — U06/U13/U20/U21/U22

Use short English UI copy. Distinguish Team, Squad list, Lineup, Invitation, Referee appointment and Match assignment. Use Team leader, Entry rules, Entry notes and On-site consistently where those labels reflect the same concept. Do not rename DTOs or flatten domain differences. Visibility and competition phase are separate facts.

Define display/page/section/body/metadata type roles; preserve Barlow Condensed for principal headings, Geist for work controls/body, Rubik Dirt only for Tournament preview. Preserve 2px corners and both approved palettes. Fix the shared light Schedule header color pair; ordinary table headings pass >=4.5:1.

Navigation exposes current route, local tabs expose a selected state and keyboard pattern appropriate to their interaction, tables name action columns, and the shell uses appropriate landmarks. Primary mobile touch targets aim for approximately 44×44px where practical; this is a usability target, not a claim that every smaller control violates WCAG.

### Trustworthy next action and recovery — U03/U04/U05/U07/U09/U16

Match Next action derives its label and destination together from existing result/state/viewer capabilities. “View history” opens History; other actions open only supported route sections. Focus moves to useful destination content.

Scan has exclusive start/ready/denied/processing/invalid/success states. Camera denial and invalid code stop a stale loading message; an asynchronous error is announced once with a supported recovery step. Failed camera preview shrinks, while Cancel/retry/manual fallback remain visible and reachable. Retain the existing secure-origin camera versus HTTP photo-capture behavior and user-chosen global Scan entry.

Registration begins with no invented gender, birth date, faculty, department or year. Selecting faculty invalidates an incompatible department selection. Validation occurs before sending the unchanged current RegisterInput payload; server field errors retain entered values.

Admin feedback removal/restore requires identifiable target context. Existing tournament comments/reviews and admin audit data may provide that context; a raw numeric ID by itself is not evidence of the target. Keep current mutation paths and permissions. If the available data cannot identify an item for a particular admin action, record that dependency and provide a truthful blocked state; do not fabricate a lookup route. Affected admin workflow cannot earn 18/20 while a blind destructive action remains the only path.

Profile stats failure offers Retry stats through the existing query, leaving account and other loaded sections intact.

### Task-first desktop workspaces — U01/U02/U08/U11/U12/U14/U15/U18/U19/U26/U27/U28

Tournament working subroutes show a compact identity/status strip and local navigation before task content. Full Details and Entry facts remain available in Overview or an accessible disclosure. Bracket/Organizer work no longer repeats the full preamble. The Tournament popup keeps its wall art, while “Public” is labeled Visibility and phase appears only if supplied.

Home preserves equal Needs you/Next match desktop peers and an 18px+ task count. **Proposed revision of the old fixed-320px short/empty-state decision:** sparse/empty peers share a compact height, while long queues use a bounded larger height and internal scroll. They remain equal as a pair. This change is explicit because the 2026-10-05 spec deliberately required 320px even when empty. On mobile peers stack and take natural height.

Referee work uses counted categories with a selected queue. Recommended layout: two card columns on desktop, one on mobile; empty categories do not occupy equal viewport width. Cards in a selected group align visually, keep the primary action visible, and preserve bounded list behavior. Result entry puts score and required completion first; team/player filtering and optional-stat disclosure retain drafts and validation. Bounded work areas show counts/continuation cues, with action footers outside their scroll body.

Inbox exposes actionable requests before notification history; Mark all read affects notification read status only. Search offers type-level navigation/counts while preserving partial-source success and retry. Organizer Request groups Tournament/Schedule/Eligibility with concise consequence-oriented hints and a review summary. Referee counts compare like units: accepted people versus required per match are separate facts. Team Members/Invites/Manage keep equal desktop frames; short Manage content is top-aligned with routine actions and a separate danger area. Admin navigation/explanation is compact without losing scope or per-item review.

### Mobile, preview fidelity and loading — U10/U17/U23/U24/U25

The mobile shell gives main content priority, while preserving an immediate Scan action, navigation, search, current location, and account access. A proposed 390px target is <=120px of shell before main content. Desktop keeps its 232px sidebar. Mobile work is accepted after desktop journeys, not inferred from the desktop score.

Mock Profile same-scope totals agree with its career rows or clearly state different scope/unavailable data. Mock MVP language agrees with the current real per-match voting model. Watch unavailable/empty states provide an actual route to a match or bracket, without implying unsupported streaming.

Split static route imports at major Admin, Organizer and advanced Match boundaries using the existing React/Vite stack, a stable Suspense fallback and chunk-error recovery. Record an equivalent-build main JS baseline and improvement; proposed initial main bundle goal <=200 kB gzip, conditional on route behavior and measured cold-load comparisons. No unsupported claim about current LCP or INP.

## Coverage and traceability

| Surface group | Required issue coverage | Owning tickets |
|---|---|---|
| Shell, global controls, Login | U06/U13/U20/U21/U22/U10 | Q10, Q20, Q23 |
| Home/discovery/popup | U11/U13/U21/U26 | Q10, Q13, Q14, Q23 |
| Team/Player/Profile | U12/U16/U17/U13/U28 | Q11, Q18, Q21, Q23 |
| Tournament/Organizer | U01/U14/U15/U26/U28 | Q13, Q16, Q15, Q23 |
| Match/Referee/Check-in/Scan | U02/U03/U04/U05/U27/U28 | Q11, Q15, Q23 |
| Admin | U09/U19/U20/U28 | Q12, Q19, Q23 |
| Search/Inbox | U08/U18 | Q17, Q23 |
| Register/MVP/Watch | U07/U24/U25 | Q12, Q21, Q23 |
| Runtime technical quality | U23 and full technical /20 | Q22, Q23 |

Q10–Q23 are proposed local tickets after completed Ticket 09; see the [ticket register](../tickets/2026-10-07-ltms-quality-20.md). One issue has one primary owner. Q23 independently verifies the full route/state matrix.

### Surface targets

The starting figures below are the earlier expert /10 scores. The target uses the new /20 rubric; they are different instruments, so “7/10 to 18/20” is a direction, not a computed gain. A fresh /20 baseline is required before implementation. Every applicable state/theme/viewport is scored separately, and the weakest required result controls acceptance.

| Surface | Earlier desktop /10 | Earlier mobile /10 | Target desktop /20 | Target mobile /20 | Primary ticket |
|---|---:|---:|---:|---:|---|
| Shell/navigation | 7 | 4 | >=18 | >=18 | Q10, Q20 |
| Home | 6 | 4 | >=18 | >=18 | Q14 |
| Tournament discovery | 7 | 6 | >=18 | >=18 | Q10, Q14 |
| Tournament preview popup | 8 | 7 | >=18 | >=18 | Q13 |
| Teams list | 7 | 6 | >=18 | >=18 | Q10, Q18 |
| Leader Team management | 6 | — | >=18 | >=18 after mobile inspection | Q18 |
| Public Team/Player | 7 | — | >=18 | >=18 after mobile inspection | Q10, Q23 |
| Tournament/Bracket | 6 | 4 | >=18 | >=18 | Q13 |
| Community | 6 | — | >=18 | >=18 after mobile inspection | Q13 |
| Organizer request | 6 | — | >=18 | >=18 after mobile inspection | Q16 |
| Organizer management | 5 | — | >=18 | >=18 after mobile inspection | Q13, Q16 |
| Matches list | 7 | — | >=18 | >=18 after mobile inspection | Q15 |
| Referee work queue | 5 | — | >=18 | >=18 after mobile inspection | Q15 |
| Match detail/Next action | 6 | 5 | >=18 | >=18 | Q11 |
| Result entry | 6 | — | >=18 | >=18 after mobile inspection | Q15 |
| Dispute review | 7 | — | >=18 | >=18 after mobile inspection | Q11, Q23 |
| Check-in roster | 6 | 5 | >=18 | >=18 | Q11, Q23 |
| Scan dialog | 5 | 5 | >=18 | >=18 plus device check | Q11, Q20 |
| Admin requests/directory | 6 | — | >=18 | >=18 after mobile inspection | Q19 |
| Admin rights/transfer/audit | 6 | — | >=18 | >=18 after mobile inspection | Q19 |
| Admin feedback moderation | 4 | — | >=18 only with target context | >=18 after mobile/context checks | Q12 |
| Search | 7 | — | >=18 | >=18 after mobile inspection | Q17 |
| Inbox | 5 | — | >=18 | >=18 after mobile inspection | Q17 |
| Login | 7 | 7 | >=18 | >=18 | Q10, Q23 |
| Register | 6 | — | >=18 | >=18 after mobile inspection | Q12 |
| Profile | 6 | 5 | >=18 | >=18 | Q11, Q21 |
| MVP | 6* | — | >=18 after active-state inspection | >=18 after mobile/active-state inspection | Q21 |
| Watch | 5* | — | >=18 after real empty-state inspection | >=18 after mobile/real-state inspection | Q21 |

*Earlier MVP/Watch scores are limited to the specific preview/source states noted in the review. The proposed targets are not achieved scores.*

## Dependency and release limits

The frontend cannot prove the absence of a backend permission or fetch individual Admin feedback if no supported endpoint/data context supplies it. The plan must surface that as a dependency rather than alter the API. Physical iPhone checks cannot be replaced by a 390px emulator. The route-level 18/20 target is not awarded until applicable states, viewports and role boundaries are observed. Unverified MVP active voting and real Watch streaming stay explicitly unverified.

Current local servers and inherited uncommitted Ticket 09/Scan files are user work. This spec does not authorize reverting them. New work stays under frontend/. No commit, push, deployment or external issue publication is requested here.
