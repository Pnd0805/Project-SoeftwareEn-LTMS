# Assessment A — visual judgment recorded before detector findings

Date: 2026-10-07. Design agent captured 32 current screenshots and DOM measures, then hit an account usage limit before writing its assessment. Root inspected the captured visual evidence and completed this assessment before opening Assessment B output. This is degraded completion, not a completed independent dual-agent verdict. Source target: `src/App.tsx`; app-wide sample. Operate mode. Mock fixtures only; no live backend or physical iPhone acceptance.

## Design specificity

The plum/cream palette, condensed athletic headings, angular frames, team colors and wall-poster Tournament preview have a coherent and product-specific identity. Preserve these. Ordinary working panels and headers overuse fixed height, borders and repeated context. Information hierarchy is less mature than visual identity. Brand strength: 8/10; desktop visual coherence: 7/10; task density and prioritization: 5/10; mobile composition: 4/10. These are expert judgments, not measured user success rates.

## Nielsen scores

| Heuristic | /4 | Evidence |
|---|---:|---|
| Status visibility | 3 | Named match/entry states, counts and explicit empty states; Scan denial still announces Starting camera. |
| Real-world language | 2 | Team/squad/leader/captain vocabulary and date formats vary; QR payload is technical. |
| Control and freedom | 3 | Cancel, back, filters and Escape supported; root verified Scan restores focus. |
| Consistency | 2 | Shared shell/colors work; multiple heading/button/tab treatments and Next action CTA mismatch. |
| Error prevention | 3 | Locked-roster explanation, disabled destructive action and consent visible. |
| Recognition | 2 | Main navigation labels visible; dense context hides destination-specific content; team readiness ambiguous. |
| Efficiency | 2 | Search, filters and bounded working sections exist; repeated context and nested scroll add steps. |
| Minimalism | 2 | Stable groupings but excessive empty frames and repeated Tournament details. |
| Error recovery | 3 | Retry/cancel patterns and explanatory source states; Scan recovery remains weak. |
| Help | 2 | Inline instructions exist, but no coherent short task help and inconsistent terms. |
| Total | 24/40 | Acceptable; significant usability refinement remains. |

## High-priority visual findings

1. P1 — Tournament task content below repeated general context. At 1440x900 the Bracket begins at y857; at 390x844 it begins at y1689. Header/Details/Entry repeat on Bracket and Community. Keep a compact identity+current state summary; put tab navigation immediately after it; collapse general details on working subroutes. Acceptance proposal: first match or queue row visible within initial 900px desktop viewport and initial 844px mobile viewport, without removing meaningful data.
2. P1 mobile / P2 desktop — Home's fixed paired 320px panels remain tall with one task and an empty next Match. Desktop Tournament heading y562 and first cards near y880; mobile Tournament heading y1208. Keep equal heights on desktop but size the pair from density (short empty/sparse state, bounded max for long lists). Stack with natural height on mobile. Avoid prescribing identical heights to unrelated mobile blocks.
3. P1 — Match next-action message says View History while primary button says Open overview and navigates to overview. Source/action mapping should agree with promised destination. Fix confirmed Match to View history -> History, preserving permission rules and match result truth.
4. P1 — Mobile shell consumes approximately 314px before content, with account details and logout competing against primary navigation. Use compact header + navigation drawer or focused bottom navigation; preserve obvious Scan and keyboard semantics. Proposed shell height <=120px before main content on 390px viewport.
5. P1 source-truth concern — Mock Profile shows 0 played/won/titles while Career shows three played, two won and a Champion. This is a visible mock mismatch, not proven live backend behavior. Reconcile same-scope summaries, or show unavailable and label different scopes; never infer fabricated totals.

## Per-surface sampled scores

| Surface | Desktop /10 | Mobile /10 | Main improvement |
|---|---:|---:|---|
| Signed-in shell | 7 | 4 | Compact mobile navigation and route semantics |
| Home | 6 | 4 | Sparse equal panels and filters push discovery below fold |
| Tournament discovery | 7 | 6 | Reduce repeated filter hierarchy, stronger event-specific metadata |
| Tournament preview | 8 | 7 | Preserve wall identity; clarify Public means visibility, not competition status |
| Teams | 7 | 6 | Team readiness context; prioritize pending invites on mobile |
| Leader management | 6 | — | Stable equal tab frame is excessively empty for Manage; group ordinary and destructive actions |
| Tournament/Bracket | 6 | 4 | Destination content appears too far down |
| Community | 6 | — | Repeated preamble and long form/feedback hierarchy |
| Matches | 7 | — | Repeated tiny tables and tournament headings; task grouping should lead |
| Match detail | 6 | 5 | Primary CTA must match Next action; compact paired frames |
| Check-in roster | 6 | 5 | Personal result should lead; repeated technical method strings |
| Profile | 6 | 5 | Contradictory mock totals and long repeated tournament tables |
| Login | 7 | — | Clean normal form; demo roles are explicitly demo-only and not production defects |

## Cognitive-load checklist

Fail: single focus (repeated green/bordered accents), visual hierarchy (task body below large preamble), minimal choices (6 sports + 4 stages + 3 relation tabs coexist), working memory (CTA/destination wording), progressive disclosure (full general Details on every Tournament task).
Pass: related grouping, information chunking within working panels, single-task dialogs. Five failures across the sampled application, with strongest overload at Tournament navigation and Home filtering. Option counts are a diagnostic, not a scientific universal maximum of four or a reason to hide useful menus automatically.

## Emotional journey and personas

- First impression: recognizable sports/retro character, especially Tournament preview. Middle: finding the actual task requires excessive scrolling. End: Scan failure message and Match CTA weaken confidence.
- First-time Player: Team versus Squad; Public versus In progress; Ready versus eligible for a particular Tournament are not immediately distinguishable.
- Busy Team Leader: Manage frame is stable but consumes a large blank area; routine controls and disabled Disband need a clearer group boundary.
- Mobile Player: first content begins below ~314px; next Match and discovery are pushed below lengthy low-density cards.

## Strengths to preserve

- Distinct Tournament wall popup with short, legible facts and explicit navigation.
- Shared dark/light tokens, angular identity and team-role frames meet the chosen brief.
- Bounded queues, equal desktop panels and leader tabs address previous user requests; improve density without undoing those behaviors.

## Evidence

`a/observations.json`, `a/measures.json`, screenshots under `a/`. Root Scan fault-injection screenshots and measured DOM: `scan/evidence.json`. No detector output was consulted before this file was written.

## Final synthesis calibration

The 24/40 above records the initial design assessment. Expanded Register and Admin workflow evidence lowers Error prevention from 3 to 2, producing the final app-wide score of 23/40 in REVIEW.md. The mock Profile mismatch is scoped to preview data and becomes P2; Home density is P2 while the mobile shell remains P1. These refinements do not imply that live-backend defects were verified.
