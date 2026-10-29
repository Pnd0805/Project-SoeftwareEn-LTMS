# R02 — Mobile Admin section disclosure

Status: implemented and locally verified, 2026-10-08. User selected the two P1 fixes and option B, collapsible section navigation.

Origin: [R02 review](../../../docs/reviews/2026-10-08-quality20-re-review/REVIEW.md). Ten vertically stacked destinations preceded the selected queue; at 390px its heading began at y966.

Design: below the existing 700px breakpoint, show Sections and the current destination in a named toggle. Keep all ten grouped route links inside it. Selecting a destination collapses the navigation and focuses the selected workspace. Desktop keeps all destinations visible; returning to mobile starts collapsed. Preserve existing authorization, queue mutations and routes.

- [x] Three regression cases fail before implementation and pass after it: initial collapsed queue, selection/focus, responsive transition.
- [x] Toggle announces expanded state and controls the hidden navigation.
- [x] All destinations reachable; keyboard Enter/Space, selection/focus and breakpoint resizing pass in browser fixtures.
- [x] Selected queue heading visible initially at 320/390/700px in both themes; desktop navigation retained at 701/1280/1440px.
- [x] Full source gates pass. Existing approval/denial/receipt behavior tests retained.

[Evidence](../../../docs/reviews/2026-10-08-quality20-p1-fixes/README.md). Long request content can still require normal scrolling to its action; physical iPhone and full Q23 acceptance remain open.
