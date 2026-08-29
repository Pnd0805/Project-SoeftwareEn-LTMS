# LTMS Frontend Build Plan (4 people)

Resolved via `/grilling` session on 2026-08-29. Source of truth: `ltms-prototype.html` (77 screens),
`FRONTEND-SPEC.md`, `CONTEXT.md`.

## Stack
Vite + TypeScript, Tailwind CSS + shadcn/ui, React Hook Form + Zod, TanStack Query, TanStack Router.

## Decisions
- **Scope**: real app is a systematic port of the existing HTML prototype + specs, wired to a real API later. Prototype is reference, not something to keep running in parallel.
- **Backend**: not ready. Build against MSW mocks / fixture JSON shaped by the shared Zod schemas. Swap real endpoints in behind TanStack Query hooks without touching components.
- **Client state**: plain React (`useState`/context) + URL search params for shareable filters/tabs. No Zustand/Redux — add only if a cross-cutting case actually needs it.
- **Domain types**: single `src/shared/` package (Zod schemas + inferred types + mock data + API client), one source of truth mirroring `CONTEXT.md` glossary. Owned by Person 1.
- **Repo structure**: one Vite app, folder-separated (`src/shared`, `src/features/*`). No pnpm workspace/monorepo — 4 people don't need package-boundary overhead.
- **Testing**: Vitest + Testing Library, per feature, written by whoever owns that feature. No shared test-infra work in phase 0 beyond config.

## Work split (by user flow, not by layer)
| Person | Owns |
|---|---|
| 1 | Auth + Home + Nav shell + `src/shared/` (types, tokens, design system) |
| 2 | Tournament + Bracket + Draw |
| 3 | Match + Results + Standings |
| 4 | Organizer + Admin + Referee management |

Each person owns a full vertical slice: routes, components, forms, queries for their screens.

## Phases

### Phase 0 — Foundation (1-2 days, whole team)
- Vite + TS scaffold, Tailwind + shadcn/ui install, design tokens from `FRONTEND-SPEC.md`
- TanStack Router base setup + role-filtered nav shell skeleton
- `src/shared/`: Zod schemas for core entities (Tournament, Team, Match, User, per `CONTEXT.md`), MSW mock handlers, typed API client wrapper around TanStack Query
- Vitest + Testing Library config
- Person 1 continues owning `src/shared/` after phase 0 lands

### Phase 1 — Feature build (parallel, per person)
Each person builds their vertical slice against `src/shared/` mocks:
- routes (TanStack Router)
- components (shadcn/ui primitives, per design tokens)
- forms (React Hook Form + Zod, reusing `src/shared/` schemas)
- data fetching (TanStack Query hooks against MSW)
- Vitest tests for their own features

### Phase 2 — Integration (whole team)
- Wire all feature routes into the shared nav shell
- Cross-flow QA: walk every user story end-to-end (guest → player → referee → organizer)
- Resolve merge conflicts in `src/shared/` schema/nav
- Swap MSW mocks for real API as backend becomes available (per-hook, no big-bang cutover)
