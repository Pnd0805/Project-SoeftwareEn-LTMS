# 08B: Use Search and Inbox consistently

**What to build:** Apply the approved Minimal Street presentation to existing Search and both Inbox modes, with readable results, supported actions and source-aware feedback.

**Blocked by:** 01 — Find the next task from Home. Independent of 08A.

**Status:** ready-for-agent — the user authorized an Orca worktree, implementation, testing and a completion commit on 2026-10-06. Merge and push remain prohibited.

**Ownership:** SearchPage, InboxPage, BackendInbox and their tests; `src/features/search/search-inbox-workspace.css`, imported only by the owned pages. Retain shared kit, stylesheet, tokens, shell, API, hooks, payloads and permissions. Record completion in this ticket and the 08B note; shared plan/index updates wait for integration.

- [ ] Search distinguishes loading, results, an empty result and source failure, retaining the existing query and recovery behavior.
- [ ] Inbox actions retain permitted destinations and visible success/error feedback when their row changes or disappears.
- [ ] Mock and real-mode Inbox preserve their distinct supported actions and source/access behavior.
- [ ] Long search results and notifications remain readable at both desktop sizes and on narrow screens, in both themes.
- [ ] Filters and actions use concise English, visible labels, keyboard access and contextual action names.
- [ ] Focused checks, rendered cases and completion evidence are recorded under Task 8B; the frozen API baseline matches.

**Review entry:** Open the [spec and execution index](../../../docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md), then Task 8B of the [implementation plan](../../../docs/superpowers/plans/2026-10-05-ltms-minimal-street.md).
