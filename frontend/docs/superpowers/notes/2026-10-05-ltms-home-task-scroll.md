# Needs you — bounded task area

User approved an internal scroll area, then requested implementation on 2026-10-05. This is another bounded Ticket 01 refinement; Tickets 02–09 remain pending.

## Delivered

Needs you has a maximum outer body height of 320px, shrinking to actual content when short. Loading, failure/retry and task rows share the bounded area. The heading displays the deduplicated task total. All tasks and existing urgency order/destinations remain available. The named Your tasks group is keyboard-focusable; focused task links have an inset outline so clipping does not hide focus. Native scrolling and overscroll containment keep wheel scrolling inside the task area. Next match keeps the approved right column; mobile continues to stack the panels.

## Evidence

- New rendered component case failed on missing task count before the implementation. It now verifies all 12 tasks, deduplication, urgent-first ordering, focusable group, destinations and singular count after refresh.
- Home/layout: 11 files / 74 tests passed.
- Full working-tree regression: 81 files / 552 tests passed, using VITE_USE_MOCK=false and VITE_API_BASE_URL=/api/v1.
- TypeScript, lint and production build pass. Existing bundle-size warning remains.
- git diff --check passes; Impeccable markup detector exits 0 without findings.
- Direct standards/spec review: no blocking findings. This is implementer review, following the no-subagent execution direction.
- All 49 frozen API/DTO/hook/store/rule hashes still match the phase baseline.

Browser fixtures use isolated mock storage and page reloads to load 21 and then 101 tasks. At 1280×800 the Tournament heading stays at document Y=562.375 for both counts. Few tasks occupy only 105px. Full task body is 320px including its border (318px client height). Checks at 1440×900, 1280×800 and 390×844, both themes, show no horizontal overflow or page errors. Keyboard End scrolls to the bottom, the final task accepts focus, and wheel scrolling at the bottom leaves document scroll at zero.

- [Desktop — 101-task fixture](home-task-scroll/task-scroll-1280-light.png)
- [Mobile — 101-task fixture](home-task-scroll/task-scroll-390-dark.png)
- [Measured results](home-task-scroll/render-results.txt)

Screenshots show test data only; production seed, live backend and user browser storage were not changed. Live backend verification remains unavailable.

## Equal-frame refinement

The user subsequently requested equal Needs you / Next match frames and a larger task count. Both frames now use a fixed 320px outer height (also for short/empty states), superseding the initial shrinking behavior. Long Next match content scrolls inside its frame; its controls keep their size. Task count uses 18px, weight 600, in the primary text color.

Browser measurements show 320/320 heights and equal widths at 1280 and 1440, both themes, and 320/320 in the stacked mobile layout. Long match names do not overflow the document; the existing View match link remains reachable. This refinement changes CSS only. Production build and diff whitespace checks pass; the existing bundle-size warning remains.
