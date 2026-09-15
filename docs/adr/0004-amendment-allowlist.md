# ADR-0004: Tournament Amendment Allowlist

- Status: Accepted
- Date: 2026-09-08

## Context

Some Tournament changes affect eligibility or registration decisions and must not be applied directly by an Organizer.

## Decision

Tournament amendments may request only registration dates, event dates, team limits, gender requirement, and age limits. Name, sport, scope, faculty, and department are not amendment fields in the MVP.

## Consequences

- C09 and C11 can validate and apply a finite set of fields.
- C08 remains limited to general fields such as `venue` and `description`.
- Unsupported keys cannot silently alter the Tournament model.
