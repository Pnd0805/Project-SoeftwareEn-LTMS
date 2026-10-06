# 08A: Use Login, Register and Profile consistently

**What to build:** Apply the approved Minimal Street presentation to existing authentication and account editing, with clear fields and retained validation/save feedback.

**Blocked by:** 01 — Find the next task from Home. Independent of 08B.

**Status:** ready-for-agent — the user authorized an Orca worktree, implementation, testing and a completion commit on 2026-10-06. Merge and push remain prohibited.

**Ownership:** LoginPage, RegisterPage, ProfilePage and their tests; `src/features/auth/account-workspace.css`, imported only by the owned pages. Retain shared kit, stylesheet, tokens, shell, API, hooks, schemas, payloads and permissions. Record completion in this ticket and the 08A note; shared plan/index updates wait for integration.

- [ ] Login and Register retain existing validation, submission, field errors, reference-data selections and redirect behavior.
- [ ] Profile retains edited selections, save feedback and avatar fallback/upload behavior, including recoverable failure.
- [ ] Long user names and validation text remain readable at both desktop sizes and on narrow screens, in both themes.
- [ ] Fields and actions use concise English, visible labels and keyboard access.
- [ ] Existing guest and mock-only controls remain truthful to the selected data mode.
- [ ] Focused checks, rendered cases and completion evidence are recorded under Task 8A; the frozen API baseline matches.

**Review entry:** Open the [spec and execution index](../../../docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md), then Task 8A of the [implementation plan](../../../docs/superpowers/plans/2026-10-05-ltms-minimal-street.md).
