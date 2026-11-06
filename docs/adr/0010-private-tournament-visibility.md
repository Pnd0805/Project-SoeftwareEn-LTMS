# ADR-0010: Hide Non-public Tournaments from General Lookup

- Status: Accepted
- Date: 2026-09-08

## Context

Tournament requests and private tournaments can contain information that should not be exposed before publication. C07 is an ID lookup and must not disclose the existence of hidden resources to ordinary users.

## Decision

Only public users can retrieve public Tournament details. Pending, rejected, and private Tournaments return `TOURNAMENT_NOT_FOUND` to ordinary users. Organizers and authorized Admins use their scoped access where applicable; request owners use C02 for pending requests.

## Consequences

- C06 and C07 do not leak hidden Tournament existence.
- Authorization checks must happen before returning hidden resource details.
