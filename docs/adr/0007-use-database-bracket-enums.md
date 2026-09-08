# ADR-0007: Use Database Bracket Enum Names

- Status: Accepted
- Date: 2026-09-08

## Context

The older API schema uses abbreviated bracket values, while the current database and Guide use full names.

## Decision

Tournament API validation uses the database values `single_elimination`, `double_elimination`, and `round_robin`. The old abbreviated values are invalid.

## Consequences

- API values can be persisted without translation.
- Clients using the old names must update before using C01.
