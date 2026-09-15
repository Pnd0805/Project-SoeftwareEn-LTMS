# ADR-0002: Limit Tournament Scope in MVP

- Status: Accepted
- Date: 2026-09-08

## Context

The database enum contains `department`, `faculty`, and `university`, but the agreed project scope has not approved university-wide tournaments yet.

## Decision

The Tournament MVP accepts only `department` and `faculty` scope. A `university` scope request is rejected until the team completes Change Management and confirms the SRS change.

## Consequences

- C01 has a smaller, explicit domain boundary.
- University-wide behavior is not silently invented in the backend.
- The database enum can remain forward-compatible without exposing the unsupported behavior through the API.
