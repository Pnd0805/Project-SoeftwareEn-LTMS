# LTMS Minimal Street — ticket index

Status: Tickets 01–07, 08A, 08B and 09 complete at their documented frontend scope. [Ticket 09 acceptance](../notes/2026-10-05-ltms-minimal-street-acceptance.md) records 25 routes, 282 captures and remaining backend/device/mobile gaps. The user authorized local integration of 08A/08B into `ltms-desktop-ux` on 2026-10-07. Combined suite: 96 files / 655 tests; see [integration evidence](../notes/2026-10-07-ltms-ticket-08-integration.md). No external issues or push. There are ten active tickets; the original 08 file is a compatibility index. Completed 06–07 and their evidence are preserved in the common snapshot commit `1459182`.

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

Tickets 02–07, 08A and 08B depend on the shared visual system established by 01, not on one another. Separate Orca workers completed 08A/08B directly without supervised orchestration or additional agents, owning separate feature stylesheets and evidence. Their user-authorized local integration on 2026-10-07 updates shared completion accounting. Ticket 09 checked the combined result; push remains prohibited.

All slices use the existing frontend-to-server paths. A vertical slice here includes the user-facing behavior, existing data consumption and verification; it does not authorize a schema or API edit.

Once the user reviews the seams, granularity and blocking edges, mark the accepted local tickets `ready-for-agent`. For external publication, configure the tracker and triage vocabulary with `/setup-matt-pocock-skills`; do not infer a destination from the repository URL alone.
