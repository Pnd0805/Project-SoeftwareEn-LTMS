# ADR-0013: External Referee Approval for Publication

- Status: Accepted
- Date: 2026-09-08

## Context

External referees have a second approval state. An accepted invitation alone does not grant an external referee operational authority.

## Decision

C13 counts a referee only when the invitation is accepted and, for external referees, `external_approval_status` is `approved`.

## Consequences

- A pending external approval cannot satisfy the publication guard.
- The active-referee predicate must be shared with later match authorization.
