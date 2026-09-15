# ADR-0006: Strict Tournament State Transitions

- Status: Accepted
- Date: 2026-09-08

## Context

Tournament publication and registration are stateful operations. Allowing repeated or out-of-order actions would create ambiguous approval and visibility behavior.

## Decision

Only the documented lifecycle transitions are valid. Invalid or repeated transitions return HTTP 409 and do not mutate the Tournament.

## Consequences

- Each action endpoint has one clear transition.
- Clients can treat 409 as a state conflict instead of a successful no-op.
