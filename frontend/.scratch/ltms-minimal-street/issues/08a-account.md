# 08A: Use Login, Register and Profile consistently

**What to build:** Apply the approved Minimal Street presentation to existing authentication and account editing, with clear fields and retained validation/save feedback.

**Blocked by:** 01 — Find the next task from Home. Independent of 08B.

**Status:** complete — implemented and verified in `ltms-ticket-08a`, commit `4a8c021`; integrated locally into `ltms-desktop-ux` under the user's 2026-10-07 authorization. [Task 8A evidence](../../../docs/superpowers/notes/2026-10-06-ltms-ticket-08a.md), [combined verification](../../../docs/superpowers/notes/2026-10-07-ltms-ticket-08-integration.md). Push remains prohibited.

**Ownership:** LoginPage, RegisterPage, ProfilePage and their tests; `src/features/auth/account-workspace.css`, imported only by the owned pages. Retain shared kit, stylesheet, tokens, shell, API, hooks, schemas, payloads and permissions. Record completion in this ticket and the 08A note; shared plan/index updates wait for integration.

- [x] Login and Register retain existing validation, submission, field errors, reference-data selections and redirect behavior.
- [x] Profile retains edited selections, save feedback and avatar fallback/upload behavior, including recoverable failure. The original Profile editor changes photos only; registry-owned identity remains read-only.
- [x] Long user names and validation text remain readable at both desktop sizes and on narrow screens, in both themes.
- [x] Fields and actions use concise English, visible labels and keyboard access. Immutable schema/upload error messages remain verbatim.
- [x] Existing guest and mock-only controls remain truthful to the selected data mode.
- [x] Focused checks, rendered cases and completion evidence are recorded under Task 8A; the frozen API baseline matches.

**Review entry:** Open the [spec and execution index](../../../docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md), then Task 8A of the [implementation plan](../../../docs/superpowers/plans/2026-10-05-ltms-minimal-street.md).
