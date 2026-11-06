# ADR-0012: Protect Approved Team Capacity

- Status: Accepted
- Date: 2026-09-08

## Context

An approved Tournament amendment could reduce `maxTeams` below the number of already approved teams, making the stored state contradictory.

## Decision

C11 rejects such an amendment with `409 TEAM_CAPACITY_CONFLICT` and leaves both the amendment and Tournament unchanged.

## Consequences

- Approval cannot invalidate existing applications.
- The Organizer must request a capacity that is at least the current approved-team count.
