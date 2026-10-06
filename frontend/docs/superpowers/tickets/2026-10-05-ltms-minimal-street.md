# LTMS Minimal Street — ticket index

Status: Tickets 01–07 complete. Tickets 08A, 08B and 09 pending; no external issues created. Ticket 08 was split at the user's request on 2026-10-06. There are ten active tickets; the original 08 file is a compatibility index. Tickets 06–07 remain uncommitted. See [Ticket 07 evidence](../notes/2026-10-06-ltms-ticket-07.md).

Start with the [spec](../specs/2026-10-05-ltms-minimal-street.md) for behavior and constraints. Open the [implementation plan](../plans/2026-10-05-ltms-minimal-street.md) when implementing a ticket; it owns exact files, interfaces and verification commands. Each ticket is stored separately following the local to-tickets format.

| Ticket | Blocked by | Reviewable outcome |
| --- | --- | --- |
| [01 — Home workspace](../../../.scratch/ltms-minimal-street/issues/01-home-workspace.md) | None | Real Home tasks and the approved shell/design system |
| [02 — Tournament preview](../../../.scratch/ltms-minimal-street/issues/02-tournament-preview.md) | 01 | Original discovery with a keyboard-safe popup |
| [03 — Team journey](../../../.scratch/ltms-minimal-street/issues/03-team-journey.md) | 01 | Membership and invitation work in the new presentation |
| [04 — Tournament participation](../../../.scratch/ltms-minimal-street/issues/04-tournament-participation.md) | 01 | Public details and registration with retained draft state |
| [05 — Organizer work](../../../.scratch/ltms-minimal-street/issues/05-organizer-work.md) | 01 | Requests, setup, reviews and Referee management |
| [06 — Match work](../../../.scratch/ltms-minimal-street/issues/06-match-work.md) | 01 | Readable Match, Check-in and supported result journeys |
| [07 — Admin work](../../../.scratch/ltms-minimal-street/issues/07-admin-work.md) | 01 | Scoped review queues with preserved outcomes |
| [08A — Account](../../../.scratch/ltms-minimal-street/issues/08a-account.md) | 01 | Login, Register and Profile consistency |
| [08B — Search and Inbox](../../../.scratch/ltms-minimal-street/issues/08b-search-and-inbox.md) | 01 | Search and both Inbox modes with retained action feedback |
| [09 — Desktop acceptance](../../../.scratch/ltms-minimal-street/issues/09-desktop-acceptance.md) | 01–07, 08A, 08B | Rendered and automated evidence plus design documentation |

Tickets 02–07, 08A and 08B depend on the shared visual system established by 01, not on one another. The user authorized separate Orca worktrees and Codex workers for 08A and 08B on 2026-10-06, with testing and a completion commit for each; merge and push are prohibited. Each worker executes its own slice directly without supervised orchestration or additional agents. Each owns a separate feature stylesheet, ticket and evidence note; shared plan/index updates wait for integration. Ticket 09 checks the combined result after both are complete.

All slices use the existing frontend-to-server paths. A vertical slice here includes the user-facing behavior, existing data consumption and verification; it does not authorize a schema or API edit.

Once the user reviews the seams, granularity and blocking edges, mark the accepted local tickets `ready-for-agent`. For external publication, configure the tracker and triage vocabulary with `/setup-matt-pocock-skills`; do not infer a destination from the repository URL alone.
