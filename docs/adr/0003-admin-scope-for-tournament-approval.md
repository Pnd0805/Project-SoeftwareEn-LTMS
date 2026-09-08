# ADR-0003: Admin Scope for Tournament Approval

- Status: Accepted
- Date: 2026-09-08

## Context

Tournament approval is restricted by the Admin scope. A faculty-scoped Admin must not approve tournaments belonging to another faculty.

## Decision

`university_wide` Admins may approve any Tournament. `faculty` Admins may approve both faculty-scoped tournaments in their faculty and department-scoped tournaments whose department belongs to their faculty. Other combinations are forbidden.

## Consequences

- Approval authorization must evaluate the Tournament's organizing faculty, not only the Admin role.
- Department scope is checked through its owning faculty.
