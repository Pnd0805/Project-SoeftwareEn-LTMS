# ADR-0011: Calculate Age Eligibility from Birth Date

- Status: Superseded
- Date: 2026-09-08
- Superseded: 2026-09-15 by `docs/spec/03-tournaments.md`

## Context

Users have a birth date, while Tournament rules express an allowed age range. Storing a mutable current-age value would become stale.

## Decision

Keep `birth_date` as the user source of truth. Keep Tournament `min_age` and `max_age` as integer boundaries, and calculate completed age as of `event_start_date` during eligibility checks.

> **Superseded timing:** latest SDS/Central Spec uses `registration_end` as the age boundary. The `birth_date` source-of-truth decision remains valid.

## Consequences

- Age is deterministic for a Tournament event.
- No user-age field or birthday-derived cache is required.
- Boundary tests must cover birthdays immediately before and after the event date.
