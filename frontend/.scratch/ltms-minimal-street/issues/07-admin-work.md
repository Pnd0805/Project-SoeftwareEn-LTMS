# 07: Review scoped Admin work

**What to build:** Apply the new workspace to Admin queues and details, preserving review scope and visible decision outcomes.

**Blocked by:** 01 — Find the next task from Home.

**Status:** complete — implemented and verified, uncommitted.

- [x] Organizer requests, Hard filter change requests and Permanent team requests remain distinct work types.
- [x] Review rows show the affected entity and current state together with the permitted decision.
- [x] Faculty and university scopes retain the existing access behavior; a staff account alone does not expose Admin work.
- [x] Decision confirmation and success/error feedback remain visible after an item leaves a queue.
- [x] User, Referee, governance and audit views share readable table and detail treatment.
- [x] Existing empty, denied and retryable-failure behavior remains intact.

**Evidence:** [Ticket 07 execution](../../../docs/superpowers/notes/2026-10-06-ltms-ticket-07.md). Focused suite 36 tests; full suite 629 tests; TypeScript/lint/build passed; 49 frozen hashes unchanged. Browser fixtures: 71 captures / 78 records. No live backend testing or commit.

**Review entry:** Open the [spec and execution index](../../../docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md), then Task 7 of the implementation plan.
