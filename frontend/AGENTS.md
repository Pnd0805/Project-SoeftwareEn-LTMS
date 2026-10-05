# Frontend agent instructions

- Read `CLAUDE.md` for repository boundaries, mock and real data paths, backend procedures, and existing verification commands.
- Keep edits within `frontend/`. Preserve current API paths, DTOs, payloads, permissions, and domain rules. Record unsupported backend capabilities in `FEAT-1-REMAINING.md` and keep the UI truthful to supported behavior.
- For the Minimal Street rollout, read `docs/superpowers/specs/2026-10-05-ltms-minimal-street.md` for product and visual decisions, then the matching task in `docs/superpowers/plans/2026-10-05-ltms-minimal-street.md` for files, interfaces, and checks. Use `docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md` for slice boundaries and dependencies.
- Start a rollout slice only after its breakdown and plan have been reviewed. Work through one slice at a time and record its completion evidence in the plan.
- Treat `src/features/home/Home.prototype.html` as a visual reference. Its sample data and prototype-only actions are not production behavior.
- For live backend work, follow the preparation and role-audit sequence in `CLAUDE.md` before accessing or testing the backend.
