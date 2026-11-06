# ADR-0001: Optional Tournament Description

- Status: Accepted
- Date: 2026-09-08

## Context

The Tournament API design allows `description` in `C08 PATCH /tournaments/:id`, but the `tournaments` table does not currently store it.

## Decision

Treat the tournament description as optional and store it as a nullable text value with a maximum length of 255 characters.

## Consequences

- The database and API contract can represent the same tournament data.
- Existing tournaments remain valid because the value may be null.
- `C08` must validate the maximum length.

## Rejected alternative

Removing `description` from `C08` would keep the old schema but contradict the agreed API contract.
