# LTMS Frontend

Local Tournament Management System — React + TypeScript + Vite.

Read [`PLAN.md`](./PLAN.md) before writing anything. It says who owns which slice, which files are
frozen, and which query-key namespace is yours. Working outside your slice without reading it is how
four people produce four merge conflicts.

## Run it

Node **20.19+** (see `.nvmrc` — this repo is built on 22.12). Vite 8 will not start on Node 18.

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Opens on http://localhost:5173. There is no backend yet — `VITE_USE_MOCK=true` serves everything from
`src/mocks/`, which is the default and needs no setup.

| Command | Does |
|---|---|
| `npm run dev` | dev server with HMR |
| `npm test` | Vitest once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | `tsc -b` then production build |
| `npm run lint` | ESLint (5 known pre-existing errors — see `PLAN.md`) |

## How the code is laid out

```
src/features/<domain>/   screens, one folder per slice — check PLAN.md for who owns which
src/shared/              ported prototype: store.ts, rules.ts, selectors.ts, types.ts  ⚠️ FROZEN
src/api/                 one file per domain, mock ↔ real switched by VITE_USE_MOCK
src/hooks/               TanStack Query wrappers — components call these, never api/ directly
src/types/               DTOs (the shape the real API returns) + enums generated from schema.sql
src/mocks/               fixtures shaped like the API, not like the store
src/schemas/             Zod, for forms
src/components/kit/      shared UI. Two layers — see below
src/styles/prototype.css every class name the ported markup uses
```

**`src/shared/store.ts` and `src/shared/rules.ts` are frozen.** No new logic goes in them. Each domain
migrates out into its own `api/` + `hooks/` pair and deletes what it replaced — that is the whole
project right now. `src/features/match/` plus `src/api/match.ts` is the worked example to copy.

**`components/kit/` has two layers.** The `*View` components (`TeamChipView`, `ScorebugView`,
`MatchStateBadge`, …) take data as props and touch nothing — use them freely with your own DTOs. The
store-backed wrappers (`TeamChip`, `Scorebug`, `StatusBadge`, …) keep the original signatures for the
un-migrated screens; changing their props breaks every caller, so ask first.

## Where the answers are

| Question | File |
|---|---|
| What is a Squad list? An Organizer? | [`CONTEXT.md`](./CONTEXT.md) — the glossary, and it wins on naming |
| What does this screen have to do? | [`FRONTEND-SPEC.md`](./FRONTEND-SPEC.md) — 77 screens |
| What does the data look like? | `../schema.sql` — 36 tables, the source every DTO is derived from |
| What is it supposed to look like? | `ltms-prototype.html` — open it in a browser |
| Who owns this file? | [`PLAN.md`](./PLAN.md) |

## Tests

Vitest + Testing Library, jsdom. Tests sit next to what they test (`chips.test.tsx` beside
`chips.tsx`) and each slice owner writes their own. `src/components/kit/chips.test.tsx` is the
example — note that it renders with no provider at all, so it fails the moment someone puts
`useLtms()` back into a pure view component.
