# 08B: Use Search and Inbox consistently

**What to build:** Apply the approved Minimal Street presentation to existing Search and both Inbox modes, with readable results, supported actions and source-aware feedback.

**Blocked by:** 01 — Find the next task from Home. Independent of 08A.

**Status:** complete — implemented and verified in `ltms-ticket-08b`, commit `30da536`; integrated locally into `ltms-desktop-ux` under the user's 2026-10-07 authorization. [Combined verification](../../../docs/superpowers/notes/2026-10-07-ltms-ticket-08-integration.md). Push remains prohibited.

**Ownership:** SearchPage, InboxPage, BackendInbox and their tests; `src/features/search/search-inbox-workspace.css`, imported only by the owned pages. Retain shared kit, stylesheet, tokens, shell, API, hooks, payloads and permissions. Record completion in this ticket and the 08B note; shared plan/index updates wait for integration.

- [x] Search distinguishes loading, results, an empty result and source failure, retaining the existing query and recovery behavior.
- [x] Inbox actions retain permitted destinations and visible success/error feedback when their row changes or disappears.
- [x] Mock and real-mode Inbox preserve their distinct supported actions and source/access behavior.
- [x] Long search results and notifications remain readable at both desktop sizes and on narrow screens, in both themes.
- [x] Filters and actions use concise English, visible labels, keyboard access and contextual action names.
- [x] Focused checks, rendered cases and completion evidence are recorded under Task 8B; the frozen API baseline matches.

**Review entry:** Open the [spec and execution index](../../../docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md), then Task 8B of the [implementation plan](../../../docs/superpowers/plans/2026-10-05-ltms-minimal-street.md).

**Task 8B completion evidence:** [owned note](../../../docs/superpowers/notes/2026-10-06-ltms-ticket-08b.md). Focused: 6 files / 40 tests; full: 95 files / 646 tests. TypeScript, lint, build, 49 frozen hashes and diff checks passed. Final browser confirmation: 78 captures / 90 records, both themes at 1280×800, 1440×900 and 390×844. Direct implementer Standards/Spec review; synthetic fixtures only. Integration and Ticket 09 remain separate.
