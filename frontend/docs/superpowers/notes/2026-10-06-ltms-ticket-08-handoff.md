# Ticket 08A / 08B Orca handoff

The user authorized two independent Orca worker worktrees on 2026-10-06. Each implements its own existing ticket, tests it and commits only its changes. No merge, push, deployment or supervised orchestration was requested.

## Common starting point

`ltms-ticket-08-base` is a local snapshot branch capturing the current `ltms-desktop-ux` working tree under `frontend/`, including completed Tasks 1–7, the Ticket 5 follow-up and the reviewed 8A/8B split. The snapshot is created with a temporary Git index; the original worktree's HEAD and index are preserved. Both new branches start from this exact snapshot, making it their common integration base.

The existing full suite passed before handoff: **93 files / 629 tests**, using `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run --reporter=dot`. Existing non-blocking jsdom `scrollTo` notice remains. Completed Ticket 7 evidence records TypeScript/lint/build passing and 49 unchanged frozen hashes. Workers must repeat baseline checks in their own worktree after dependency setup, then verify final changes before committing.

## Ownership

- **08A:** LoginPage, RegisterPage, ProfilePage, related tests, `src/features/auth/account-workspace.css`, its ticket, `docs/superpowers/notes/2026-10-06-ltms-ticket-08a.md` and `notes/ticket-08a/` evidence.
- **08B:** SearchPage, InboxPage, BackendInbox, related tests, `src/features/search/search-inbox-workspace.css`, its ticket, `docs/superpowers/notes/2026-10-06-ltms-ticket-08b.md` and `notes/ticket-08b/` evidence.
- Shared kit, styles, tokens, shell, schemas, API, DTOs, hook implementations, store, rules, dependencies and configuration stay intact. Each stylesheet is imported by its own pages and scopes selectors to those page roots.
- Shared plan/index completion updates and Ticket 09 wait for a later user-authorized integration. Current frontend AGENTS.md/CLAUDE.md remain applicable; this user authorization overrides their earlier single-worktree, one-slice-at-a-time and commit-on-request constraints for these two tickets only.

## Worker delivery

Read the ticket, matching plan task, approved spec, frontend AGENTS.md/CLAUDE.md and Impeccable workflow. Implement directly without further agents. Preserve all existing handlers, source states, payloads, permissions, routes and recoverable draft behavior. Use concise English and the existing Minimal Street design.

Verify the focused suite, TypeScript, lint, full real-mode suite, production build, all 49 frozen hashes and `git diff --check`. Record dark/light rendered evidence at 1280×800, 1440×900 and 390×844; use synthetic intercepted fixtures and preserve backend limitations. No live backend mutations. Document unavailable browser evidence honestly rather than claiming it passed.

After the required source checks pass, commit only owned changes. Report the commit SHA, test counts, changed files, screenshots and any remaining gaps. A failing gate must be resolved or reported; do not claim the ticket complete. Merge and push remain prohibited.
