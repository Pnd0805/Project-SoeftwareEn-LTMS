# 04: Enter and follow a Tournament

**What to build:** Apply the approved hierarchy through public Tournament details, schedule, bracket, Leaderboard, community and the Team Leader's registration flow.

**Blocked by:** 01 — Find the next task from Home.

**Status:** complete — implementation and verification recorded in [Ticket 04 evidence](../../../docs/superpowers/notes/2026-10-06-ltms-ticket-04.md).

- [x] Tournament identity, state and available action are visible before secondary content.
- [x] Existing tabs and destinations remain usable, including dense brackets and schedules.
- [x] Registration distinguishes Team members, the submitted Squad list, Hard filter checks and Entry notes.
- [x] Recoverable refresh errors preserve selected Players, open form identity and unconfirmed-submission feedback.
- [x] Loading, 404, denial, network failure and unknown eligibility/capacity remain distinct.
- [x] Community and result-related read views retain their existing permission and outcome handling.
- [x] Blocks use a consistent grid, aligned edges and equal widths/heights within the same group. Use 20px inner padding and 24px between major groups, with compact spacing for related controls.
- [x] Schedule and Bracket have a broad reading area with contained scrolling. Long lists stay accessible; short/empty/loading panels retain the group's frame size. Narrow screens stack the groups with the same spacing rhythm.
- [x] Entry action is prominent near the Tournament identity; registration keeps the selected-player count and Submit visible while scrolling.
- [x] Schedule offers local team search and round/state filters, with Clear filters and distinct no-match feedback. Bracket offers left/right navigation and selected-team highlighting from already loaded data.

**Layout refinement requested by the user:** keep Minimal Street typography, angular corners and A's palette while making the block composition even and comfortable to scan. Align headings and actions across peer blocks. Verify long names, dense content, keyboard scrolling and both themes; existing data sources and API contracts stay authoritative.

**Review entry:** Open the [spec and execution index](../../../docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md), then Task 4 of the implementation plan.
