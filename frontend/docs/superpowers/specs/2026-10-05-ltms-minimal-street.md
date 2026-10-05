# LTMS desktop — Minimal Street

Status: visual direction approved; implementation spec prepared for review.
Date: 2026-10-05

## Problem Statement

People find LTMS difficult to use, visually crowded and confusing. They need clearer navigation, readable Tournament information and an obvious next action across Guest, Player, Team Leader, Organizer, Referee and Admin journeys. The approved prototype now establishes the desired appearance, but the application still uses its earlier presentation.

## Solution

Apply the approved B workspace layout throughout the desktop frontend, using A's original color families and Tournament discovery structure. Use a persistent sidebar for signed-in users, short English copy, angular corners, bold condensed headings and restrained street character. Keep body text and working controls calm and readable. A Tournament preview popup provides a short summary before opening the full Tournament.

This is a frontend presentation rollout over the existing working data flows. Current permissions, domain decisions and mutation contracts remain authoritative.

## User Stories

1. As a Guest, I want public Tournaments first, so that I can browse without a personal work queue.
2. As a signed-in user, I want Home to show Needs you first, so that I can identify my next permitted task.
3. As a signed-in user, I want stable sidebar destinations and the correct active section on deep pages, so that I can locate myself and return.
4. As a user with different responsibilities in different Tournaments, I want actions to reflect the current context, so that a label does not imply a global permission.
5. As a user, I want search, notifications, my profile and theme controls in consistent positions, so that I can reach them from any working page.
6. As a user, I want the original Tournament cards, relationship categories, sport filters and Stage control, so that I keep a familiar discovery workflow.
7. As a user, I want a Tournament card to open a readable preview, so that I can inspect the available facts without losing my list position.
8. As a user, I want the preview to offer the full Tournament destination, so that I can continue to details or the existing management destination.
9. As a user, I want closing a preview to retain my filters and return focus to its card, so that I can continue browsing.
10. As a user, I want unavailable Tournament facts to remain unknown, so that an inferred capacity, organizer or lifecycle does not mislead me.
11. As a user, I want loading, empty, denied and failed data to look distinct, so that I know whether to wait, change a filter or retry.
12. As a user, I want available work to remain visible when another source fails, so that partial failure does not erase my context.
13. As a Player, I want my Team and invitations presented separately, so that I can distinguish membership from a pending invitation.
14. As a Team Leader, I want Team members, invitations and management actions clearly grouped, so that I can prepare my Team.
15. As a Team Leader, I want Squad list selection, Hard filter results and Entry notes to remain clear, so that I can submit an informed Tournament entry.
16. As a Team Leader, I want my selected Players and submission feedback retained after a recoverable refresh failure, so that I can recover without repeating the form.
17. As a participant, I want the Tournament overview, schedule, bracket and Leaderboard to share a clear hierarchy, so that I can follow the Tournament.
18. As an Organizer, I want setup prerequisites and the existing next action visible together, so that I can prepare and publish a Tournament.
19. As an Organizer, I want registrations and Soft filter decisions presented with their Team context, so that I can review the correct entry.
20. As an Organizer, I want Referee invitations, accepted appointments and Match assignments distinguished, so that I understand the staffing state.
21. As a Referee, I want my assigned Matches and supported result actions easy to scan, so that I can carry out the work available to me.
22. As a Player or Team Leader, I want Match status, Lineup, Check-in and result information in a consistent layout, so that I can follow the permitted next step.
23. As an Admin, I want review queues to retain their scope, item identity and outcome feedback, so that I can decide with the correct context.
24. As a user, I want sign-in, account, search and Inbox pages to share the same controls and spacing, so that the application feels coherent.
25. As a keyboard user, I want visible focus, named controls and contained dialog focus, so that I can complete the same work without a mouse.
26. As a user, I want dialogs to close through an explicit control or Escape and return me to the originating context, so that temporary views are predictable.
27. As a user, I want text and status labels readable in both themes, so that color is not the only source of meaning.
28. As a user, I want long Tournament names, Team names and dense data to remain usable on desktop, so that real content does not break the layout.
29. As a returning user, I want the application to retain my theme preference, so that the redesign respects my working environment.
30. As the backend integration team, I want the frontend's API contracts and payloads preserved, so that the redesign can reconnect without a contract migration.

## Implementation Decisions

### Approved visual system

- Preserve B's page organization and signed-in sidebar, with A's Tournament cards, category tabs, sport filters and Stage control.
- Inherit A's existing dark and light colors. Dark mode uses aubergine surfaces, warm cream text and emerald actions; light mode uses warm cream surfaces, brown text and deep green actions. Keep semantic warning and error colors with text labels.
- Use nearly square 2px corners. Define surfaces with crisp outlines. Reserve a small offset shadow for the primary action and normal elevation for dialogs. Use flat page backgrounds and generous separation between groups.
- Use self-hosted Barlow Condensed Bold for principal headings, Tournament names and sport bands. Use the installed Geist family for body text, form labels and controls. Keep uppercase selective and preserve the font license.
- Keep interface wording concise and English. Domain terms retain their glossary meaning: Team members, Squad list, Lineup, Invitation, Referee appointment and Match assignment are distinct.

### Navigation and Home

- Use the existing Home destination for the signed-in task-first view. Use the existing all-Tournaments category destination for sidebar Tournament discovery. Guest Home remains public Tournament discovery.
- Resolve active navigation by route family. Preserve the current Admin access probe and scope handling, search, notifications, profile shortcut, sign-out and theme persistence.
- Render Needs you from the existing source-aware task feeds. Preserve per-source loading, retry and empty states. Approved follow-up: cap its scrollable body at 320px, show the deduplicated task count, retain all tasks and urgency order, and support native mouse/keyboard scrolling so list length does not keep pushing Tournament discovery down. Latest approved refinement: both Needs you and Next match frames have the same fixed 320px height, including short/empty states; either frame scrolls internally when needed. Task count uses 18px semibold text. This supersedes shrinking short task frames. The standalone prototype's sample tasks are not production data.
- Follow-up approved on 2026-10-05: signed-in Home uses two equal desktop columns, Needs you on the left and Next match on the right; stack them on mobile. Next match selects the nearest future scheduled/check-in-open match from the existing personal Match source only when participants and schedule are known. Show the Tournament, teams, time, venue (or Venue not set) and View match. Preserve the right column with No scheduled match when empty; distinguish loading/error/retry. This supersedes expanding the task area when no fixture exists. No new endpoint or inferred action capability is authorized.

### Tournament preview

- Open a read-only summary from a Tournament card. Use the existing shared accessible dialog and an explicit Close control.
- Populate the summary from the current permitted list data. Show known name, sport and available facts. Omit unknown organizer, capacity, visibility or lifecycle instead of using adapter defaults as proof.
- Keep preview selection in a URL query parameter while preserving other query parameters. Resolve the selected identifier only against the current permitted list; an unknown or removed identifier does not trigger a new fetch or expose a stale private record.
- The full-page action preserves the card's existing destination, including the management destination where the existing relationship already provides it. Full-page permissions remain authoritative.
- Closing, Escape and browser Back preserve browsing context. A refresh that removes the selected item closes the preview rather than retaining an inaccessible summary.

### Rollout and compatibility

- Apply the shared design language through the current shell, kit and styles, then adapt each existing journey. Preserve current domain behavior, role boundaries and recoverable form state.
- Freeze API adapters, DTOs, hook implementations, the shared mutation store and shared business rules at the start of this phase. Compare against that working-tree baseline, which already contains earlier authorized corrections.
- Reuse installed UI infrastructure and the approved font asset. The new presentation does not require a runtime dependency or build configuration change.
- Work directly in the existing isolated frontend worktree. Commits, pushes, external publication and subagent work follow the user's existing explicit constraints.

## Testing Decisions

- Use rendered pages and route navigation as the primary test seam. Assert what the user sees, which destination opens, what remains after a failure and whether keyboard focus is restored. Avoid tests of CSS strings, internal state names or component structure.
- Add behavioral coverage for Home versus Tournament navigation and Tournament preview lifecycle. Reuse the existing Home real-mode, shell access and Modal tests as prior art.
- Reuse the current Team, registration, Tournament, Match, Admin, Inbox and Profile regression suites when applying presentation changes. Add a test only for a new behavior or a concrete regression risk those suites do not cover.
- Verify desktop at 1280 × 800 and 1440 × 900 in both themes, including long names, empty and failed sources, restricted viewers and an open dialog. Check visible focus, dialog escape/return, no page-level horizontal overflow, and text contrast of at least 4.5:1 on the actual surface.
- Complete TypeScript, lint, the full frontend suite and a production build. Compare the frozen-file baseline. These checks establish source and regression confidence; they do not replace rendered or live-backend acceptance.

## Out of Scope

- Backend, schema, endpoint, DTO, payload, permission or domain-rule changes.
- New Match capabilities, fabricated metrics, sample Tournament relationships or sample fixture data in production.
- Mobile redesign in this desktop rollout. Retain usable responsive behavior while mobile remains a later phase.
- Rewriting completed source-state/accessibility corrections or broad module refactoring unrelated to the approved presentation.
- Commit, push, deployment or external issue publication without the required destination and authorization.

## Further Notes

- Visual authority: [approved direction and later refinements](2026-10-05-ltms-visual-direction.md) and [the B prototype](../../../src/features/home/Home.prototype.html?variant=B). The prototype's layout and material treatment are reference; its invented data and shortcuts are not production behavior.
- Execution details belong in the [implementation plan](../plans/2026-10-05-ltms-minimal-street.md). Work boundaries and reviewable outcomes belong in the [ticket index](../tickets/2026-10-05-ltms-minimal-street.md).
- The earlier correction batch passed 79 files / 537 tests, TypeScript, lint and build. That is prior evidence, not verification of this unimplemented rollout.
- Browser access and a running backend were unavailable during previous acceptance. Keep those conditions visible until they are actually verified.
- No issue-tracker configuration was found. These artifacts are local review drafts; tracker setup is available through `/setup-matt-pocock-skills` before external publication.
