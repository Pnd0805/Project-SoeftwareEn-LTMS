# LTMS desktop UX/UI redesign

Date: 2026-10-04
Status: Draft for team review
Scope: Frontend experience across every role, delivered in separate, reviewable phases

## Intent and decisions

The team reports that LTMS is hard to use, visually unattractive, visually crowded, and confusing. The goal is a clearer and more attractive experience throughout the existing frontend. Desktop is the first target; the same interaction model will be adapted for mobile after desktop flows are accepted. The interface remains in English and keeps the existing LTMS identity: its dark palette, green accent, logo, and street graffiti/sticker character.

The partner selected a **task-first home layout** (visual option A) and **Bold Street** treatment (visual option B). Prominent outlines, hard shadows, and slight sticker angles remain. Cleanliness comes from stronger grouping, fewer simultaneous calls to action, more space between groups, and consistent type hierarchy. The chosen style is not a switch to a generic flat dashboard.

Buttons and status labels use short English wording. A button is usually one or two words when its surrounding card or section makes the object clear: `Review`, `Save`, `Retry`. Add the object only when two actions could be confused. Supporting text carries detail such as prerequisites, deadlines, or consequences.

## Program boundaries

This is a system-wide UX/UI program, not a single screen change. It is split so each phase can be designed, implemented, and accepted without leaving half-redesigned role journeys:

1. **Desktop foundation and task-first home:** shared shell, navigation, visual rules, page structure, common feedback states, and a real-data work queue.
2. **Guest, player, and team leader journeys:** finding a tournament, team membership, registration, and personal follow-up.
3. **Organizer and referee journeys:** tournament setup, invitations and assignments, check-in, results, and disputes.
4. **Admin journeys and cross-role consistency:** review queues, decisions, audits, and final terminology/state alignment.
5. **Mobile adaptation:** apply the accepted hierarchy and flows to narrow screens, then validate touch and camera-related tasks.

This document defines the common design and the first implementation phase. Each later journey phase gets its own focused design and acceptance checklist before implementation. All existing routes remain in the coverage inventory; a later phase is not a decision to omit those screens.

The frontend owns the work. Backend data gaps are recorded as contracts for the backend team rather than filled with guessed actions or stale local state. The existing business rules and permissions remain authoritative.

## Desktop experience architecture

### Shared shell and navigation

The existing role-aware `Shell` remains the navigation frame. It keeps a stable left navigation area and top bar with search, notifications, and profile. Labels, order, active state, spacing, and grouping are standardized across roles. Role-specific items appear only when the viewer has access. Deep pages show a breadcrumb and explicit route back to their parent section.

The home page leads with **work awaiting this user**. Each work item names the action, its context, any deadline or prerequisite, and a direct destination. Tournament browsing follows below it. Guests, who have no personal work, begin with tournament discovery. This preserves the selected task-first hierarchy without showing an empty personal queue to guests.

Each major page follows one visual order: page title and current status; primary action; working content; supporting facts. Detailed pages may use the existing split layout with the work on the left and a facts rail on the right. The first desktop viewport at 1280 × 800 should show the page title, status, and primary action without scrolling.

### Reusable interface rules

Shared components or shared conventions cover page headers, action cards, form fields, status panels, confirmation dialogs, and empty/loading/error states. They use the established design tokens and `src/components/kit/` patterns. There is one visually dominant action per context; secondary actions sit beside their related information. A destructive action retains a clear confirmation and consequence statement.

Bold Street treatment remains visible on navigation selection, primary action surfaces, important cards, and badges. Repeated data rows, help text, and facts use quieter grouping so strong borders and shadows indicate hierarchy. Both existing light and dark themes retain equivalent contrast and focus visibility. The redesign uses existing token names or deliberately updates them in the shared stylesheet; feature screens do not introduce their own palette.

Long flows show the current step, what remains, and the next available action. Disabled or unavailable actions explain the unmet condition. Forms keep labels visible, show validation beside the affected field, preserve user input after a recoverable error, and confirm the result after save. Status wording says what happened and what to do next in short language.

## Work-item data flow

The current `HomePage` sets its work queue to an empty array in real mode, so the selected task-first design requires a real-data path. Domain-owned selectors derive work items from the relevant TanStack Query results and permissions. A shared composer orders and presents those items; it does not infer an action from a tournament or match status alone when the API cannot confirm the viewer can perform it.

The common work-item shape contains a stable key, short action label, context, urgency, destination route, and source domain. A domain owns the logic that turns its server result into an item. The shared home consumes these items and renders them consistently. This follows the ownership split in `PLAN.md` and avoids expanding the prototype store.

Each source can be loading, ready, empty, or failed independently. A failed source does not erase successfully loaded items from other domains. The home explains that some work could not be loaded and offers a retry for the affected source. A true empty state says the user has no current tasks and points to tournament browsing. A missing backend contract is tracked explicitly; it never becomes a fictional task card.

The mock path continues to support demo and component testing, but uses the same display shape as real mode. Backend authorization remains final when the user opens or submits a task. A stale card that now yields 403/409 shows the server reason and refreshes its source.

## Delivery and acceptance

For the desktop foundation, acceptance requires:

- Stable navigation and page hierarchy for guest, player/team leader, organizer, referee, and admin fixtures.
- Actionable work items in real mode for every role/domain where an existing API exposes the needed state, with a documented coverage map for any unavailable source.
- Clear loading, empty, partial-error, permission, validation, and success states. Each visible task opens its intended route.
- No page-level horizontal overflow at 1280 × 800 and 1440 × 900. Main actions remain visible in the first viewport on major pages.
- Keyboard access to navigation, actions, dialogs, and forms; visible focus; text contrast at least 4.5:1 on its actual surface.
- Existing unit/component tests for work-item selection and state variants, plus scripted desktop walkthroughs of one representative task for each role. Run TypeScript, lint, the full frontend test suite, and production build before phase acceptance.

Later phases add journey-specific walkthroughs: discover and register; set up and run a tournament; accept and officiate a match; review and decide an admin request. Reviewers record points where the next action, status, or result is unclear and revise the corresponding phase before moving on. Mobile receives its own viewport, touch, and camera checks after desktop acceptance.

## Repository constraints and references

- Work in `frontend/`. `backend` is owned by the other team. Coordinate changes to shared shell, styles, kit, route table, and query-key namespaces under `PLAN.md`.
- Keep `src/shared/store.ts` and `src/shared/rules.ts` frozen except for an explicitly reviewed bug fix. Do not grow the prototype store to provide real-mode tasks.
- `FRONTEND-SPEC.md` and `CONTEXT.md` remain references for domain terms and existing user journeys. Where historical design wording conflicts with current backend contracts, verify the current source before changing copy or behavior.
- The existing `feat/1` branch is the frontend baseline. The latest backend reference at design time is `origin/BE_KN@6aafe07`; the first phase must record API coverage before implementing the real-data queue.
