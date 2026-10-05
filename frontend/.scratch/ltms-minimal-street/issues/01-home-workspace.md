# 01: Find the next task from Home

**What to build:** The approved Minimal Street workspace on real Home data: a signed-in sidebar, clear Home and Tournaments destinations, readable Needs you rows and the existing global controls. This slice establishes the shared visual treatment through a complete Home journey.

**Blocked by:** None (can start after the breakdown is approved).

**Status:** complete — implemented and verified on 2026-10-05.

- [x] Signed-in Home shows existing tasks and source-specific loading, empty and retry states; Guest Home leads with public discovery.
- [x] Home and Tournaments are distinct sidebar destinations, and deep pages retain an accurate active parent.
- [x] Admin navigation still follows verified access; search, profile, notifications, sign-out and theme persistence retain their behavior.
- [x] A's colors, condensed headings, 2px corners and readable body controls match the approved prototype.
- [x] Shared frames, fields and dialogs use the same treatment without changing API contracts.
- [x] Approved follow-up: Needs you occupies the left half; Next match occupies the right half with confirmed existing schedule data, explicit empty/loading/error states and a View match link. Mobile stacks the two sections.

**Review entry:** Open the [spec and execution index](../../../docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md), then Task 1 of the implementation plan.

**Evidence:** [Ticket 1 verification and review](../../../docs/superpowers/notes/2026-10-05-ltms-ticket-01.md). Live backend verification remains outside this slice.

**Follow-up evidence:** [50/50 Home and Next match](../../../docs/superpowers/notes/2026-10-05-ltms-home-next-match.md).
