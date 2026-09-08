# ADR-0009: Keep Registration Consistent with Publication

- Status: Accepted
- Date: 2026-09-08

## Context

Registration is a separate boolean from the Tournament lifecycle, but a private Tournament must not continue accepting public applications.

## Decision

C15 is valid only for a public Tournament. C16 is valid only for an open public Tournament. C14 is valid only after registration is closed.

## Consequences

- The system cannot create a private-and-open registration combination.
- Organizers close registration before unpublishing.
