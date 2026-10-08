# ADR-0002: Limit Tournament Scope in MVP

- Status: Accepted
- Date: 2026-09-08

## Context

The database enum contains `department`, `faculty`, and `university`, but the agreed project scope has not approved university-wide tournaments yet.

> **2026-09-15 clarification:** the latest SDS now models all three scope values. The delivery decision below is nevertheless reaffirmed for the current MVP API/UI: `university` remains deferred, while the domain/database model keeps the value for later activation.

## Decision

The Tournament MVP accepts only `department` and `faculty` scope. A `university` scope request remains rejected/deferred until the team explicitly activates the release after the related authorization, filtering, and UI behavior are ready.

## Consequences

- C01 has a smaller, explicit domain boundary.
- University-wide behavior is not silently invented in the backend.
- The database enum can remain forward-compatible without exposing the unsupported behavior through the API.
