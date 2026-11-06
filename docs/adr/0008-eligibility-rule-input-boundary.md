# ADR-0008: Eligibility Rule Input Boundary

- Status: Accepted
- Date: 2026-09-08

## Context

The current C01 contract contains direct gender and age restrictions, while `tournament_eligibility_rules` stores optional year and faculty rules. C01 has no rule-management input.

## Decision

C01 does not create or modify year/faculty eligibility rules. C17 reads the existing rows and returns an empty list when none exist. Gender and age remain Tournament fields.

## Consequences

- The MVP keeps the documented C01 request shape.
- Rule-management behavior is not invented inside the Tournament creation endpoint.
- Later application filtering can consume both direct Tournament restrictions and stored rules.
