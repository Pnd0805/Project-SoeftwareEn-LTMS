# Redesign LTMS UX/UI across roles, desktop first

## Problem Statement

People find LTMS hard to use, visually crowded, unattractive, and confusing. The next action, current status, and path back are not consistently clear across the Guest, Player, Team Leader, Organizer, Referee, and Admin journeys. The home screen shows work items only with mock data; in real mode its task queue is empty. The redesign must cover the whole frontend while keeping LTMS recognizable.

## Solution

Create a consistent desktop experience across LTMS, delivered in reviewable phases. Keep the existing dark and green palette, logo, and street graffiti/sticker character. Use the selected **task-first home** and **Bold Street** visual style: strong outlines and shadows on primary surfaces, calmer grouping for dense content. Use short English labels, clear status, one dominant action per context, visible progress and prerequisites, and useful loading, empty, success, and error states. Derive real-mode home tasks from verified server data and the viewer's permissions. Adapt the accepted desktop experience for mobile in a later phase.

## User Stories

1. As a Guest, I want public Tournaments shown first, so that I can discover one without seeing an irrelevant personal task queue.
2. As a Guest, I want clear sport and stage filters, so that I can narrow Tournaments quickly.
3. As a Guest, I want public Tournament details, schedule, bracket, Leaderboard, and Match results to use the same page structure, so that I can move between them without relearning the interface.
4. As a signed-in user, I want my pending work at the top of Home, so that I know what to do next.
5. As a signed-in user, I want each work item to name the action and its Tournament, Team, or Match, so that I understand its context.
6. As a signed-in user, I want deadlines and prerequisites visible on relevant work items, so that I can judge urgency and readiness.
7. As a signed-in user, I want a work item to open the correct destination directly, so that I do not have to search for the action.
8. As a signed-in user, I want Home to distinguish loading, no work, and a failed source, so that I know whether to wait, browse, or retry.
9. As a signed-in user, I want available work from other areas to remain visible if one source fails, so that a partial outage does not hide my tasks.
10. As a signed-in user, I want stale work to show the server's permission or conflict result and refresh, so that I can recover safely.
11. As a signed-in user, I want stable navigation and an accurate active section, so that I know where I am.
12. As a signed-in user, I want only destinations I can access in navigation, so that the menu matches my permissions.
13. As a signed-in user, I want deep pages to show their parent section and route back, so that I can return without guessing.
14. As a Player, I want my Team, Invitations, Lineup, Check-in, and Match information to be easy to find, so that I can follow my participation.
15. As a Player, I want the next Check-in action and its condition shown clearly, so that I know when and how to mark myself present.
16. As a Team Leader, I want Team readiness and missing members explained, so that I can prepare a Team for registration.
17. As a Team Leader, I want an Invitation's pending or accepted state shown clearly, so that I do not mistake an invitation for membership.
18. As a Team Leader, I want registration steps, Hard filter results, and the submitted Squad list explained, so that I can complete entry with confidence.
19. As a Team Leader, I want Entry notes shown before registration, so that I understand what the Organizer will review in the Soft filter.
20. As a Team Leader, I want Match Lineup, result confirmation, and Dispute actions shown in context, so that I can manage the Team's next Match.
21. As an Organizer, I want Tournament setup to show progress and missing prerequisites, so that I can publish and run the Tournament in the right order.
22. As an Organizer, I want registration reviews and Soft filter decisions grouped by Tournament, so that I can process pending Teams efficiently.
23. As an Organizer, I want Referee invitations, appointments, and Match assignments distinguished, so that I know who has accepted and who is assigned.
24. As an Organizer, I want the current Tournament state and next available action prominent, so that I can run the Draw, schedule, and Match workflow without confusion.
25. As an Organizer, I want Disputes and result decisions shown with the affected Team and Match, so that I can resolve them accurately.
26. As a Referee, I want accepted Tournament appointments and assigned Matches easy to find, so that I can prepare for the work assigned to me.
27. As a Referee, I want the Match status and available result actions clear, so that I can record scores and Player statistics at the right time.
28. As an Admin, I want Organizer requests, Hard filter change requests, and Permanent team requests in clear review queues, so that I can make each decision with the right context.
29. As an Admin, I want a decision's outcome and audit information shown clearly, so that I can verify what happened.
30. As any user, I want one visually dominant action per context, so that the page gives me a clear next step.
31. As any user, I want unavailable actions to explain their unmet condition, so that I know how to proceed.
32. As any user, I want forms to keep labels visible and show errors beside affected fields, so that I can correct them quickly.
33. As any user, I want recoverable errors to preserve my entered data, so that I do not repeat work.
34. As any user, I want saves and decisions to confirm the outcome in short language, so that I know the operation completed.
35. As any user, I want destructive actions to state their consequence before confirmation, so that I can make an informed choice.
36. As a keyboard user, I want navigation, forms, dialogs, and actions to have a visible focus order, so that I can complete the same flows without a mouse.
37. As any user, I want readable text and clear status cues in both themes, so that the interface remains usable.
38. As a mobile user, I want the accepted journeys adapted to narrow screens and touch controls after desktop acceptance, so that I can perform the same core tasks on my phone.

## Implementation Decisions

- Deliver five phases: desktop foundation and task-first Home; Guest, Player, and Team Leader journeys; Organizer and Referee journeys; Admin and cross-role consistency; then mobile adaptation. Maintain a coverage inventory for all existing routes. Each later journey phase gets focused design and acceptance criteria before implementation.
- Keep the existing role-aware shell and standardize its navigation order, labels, grouping, active state, search, notifications, profile, and breadcrumbs. The first desktop viewport should show a major page's title, status, and primary action.
- Keep LTMS's palette, logo, and street character. Apply prominent outlines, hard shadows, and sticker details to navigation selection, main actions, important cards, and badges; make repeated rows and supporting facts quieter. Use shared design tokens and components instead of feature-specific palettes.
- Use concise English labels, usually one or two words when context names the object. Add the object when two actions could be confused. Supporting copy carries deadlines, prerequisites, and consequences.
- Use a common hierarchy: title and status, primary action, working content, then supporting facts. Long flows show current step and remaining work. Forms provide inline validation and retain input after recoverable failures.
- Make the real-mode Home queue from domain-owned selectors over verified server query results and permissions. A shared composer displays, deduplicates, and orders the domain work items. Each item needs a stable key, concise action, context, urgency, destination, and source domain.
- Keep source loading, empty, and failure states independent. A failed source must not erase items from successful sources. Do not infer user actions from a status alone, invent unavailable backend contracts, or use persisted mock state for real-mode tasks. The server remains authoritative for permissions and final writes.
- Keep mock data useful for demos and tests, but map it to the same presentation shape. Preserve existing business rules and route behavior unless a journey phase explicitly changes them.
- Frontend work stays within the frontend ownership boundary. Record backend data gaps as contracts for the backend team. Coordinate changes to shared shell, styles, components, routes, and query keys across existing feature ownership.

## Testing Decisions

- Test behavior visible to a person: which action appears for a role and server state, where it goes, what a form or decision reports, and how the page behaves when data is absent or fails. Avoid tests tied to component internals or exact CSS structure.
- Prefer the rendered page and route boundary as the main test seam for each representative role journey. Use the existing frontend mock server and query fixtures to supply server states. Test the work-item composition at its public domain boundary where combinations of permissions, statuses, and partial failures would be cumbersome to express through a page.
- Extend existing Home category tests, shell role tests, and page-level real-mode tests as prior art. Existing form, Inbox, Admin, registration, and Match tests provide examples for success, permission, validation, and conflict states.
- Walk through one representative task per role on desktop. Check 1280 × 800 and 1440 × 900 for visible primary actions and no page-level horizontal overflow; check keyboard operation, visible focus, dialogs, both themes, and text contrast of at least 4.5:1 on the actual surface.
- Before accepting each desktop phase, run TypeScript checks, lint, the full frontend test suite, and a production build. Mobile gets separate narrow viewport, touch, and camera-related checks after desktop acceptance.

## Out of Scope

- Backend implementation, database changes, and changes to the team's shared planning sheet.
- New Tournament, Team, Match, or permission rules introduced only to fill a visual gap.
- Mobile implementation during the desktop phases. Mobile remains part of the overall program as phase five.
- Treating the prototype store as the source of real-mode tasks.

## Further Notes

- The selected visual directions are task-first layout A and Bold Street style B. The desktop design draft records those decisions and the phased acceptance criteria.
- Domain wording follows the frontend glossary: Tournament, Team Leader, Squad list, Lineup, Hard filter, Entry notes, Soft filter, Invitation, Referee appointment, Match assignment, Dispute, and Leaderboard have distinct meanings.
- Current real-mode Home work queue is empty by construction. The first phase must map available API coverage for work items and explicitly record missing contracts.
- The issue is ready for team design review. Product implementation begins after the written design and implementation plan are reviewed under the active brainstorming workflow.
