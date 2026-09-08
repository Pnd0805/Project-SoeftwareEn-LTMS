# ADR-0014: Add a Migration for Tournament Description

- Status: Accepted
- Date: 2026-09-08

## Context

The repository has a canonical schema file but no migration framework. Existing MySQL volumes therefore do not receive new columns automatically.

## Decision

Add `description` to the canonical schema and database design documentation, and provide a standalone migration for existing databases. Never delete the existing MySQL volume to apply this change.

## Consequences

- Fresh databases and existing databases can converge on the same schema.
- The migration can be run once without destroying local or teammate data.
