# Desktop journey correction panel

Date: 2026-10-04

Three independent Sol 6.1 High reviewers inspected accessibility, product usability, and permissions/data contracts. Each reviewed the combined correction scope before implementation.

## Shared decisions

- Correct existing Modal keyboard/name/focus behavior at the shared component boundary, preserving its props and dismissal semantics.
- Registration must announce an unconfirmed network outcome, retain selected players and show the selected count. An unsuccessful response does not prove the server did not register the squad; no automatic replay.
- Public discovery distinguishes unavailable/404 from permission, network and server failures. Disabled Guest/private queries do not govern loading or emptiness.
- Keep independently successful Teams, Invitations and Entries content usable when another source fails, with source-specific retries.
- Team detail gets semantic identity and contextual actions while retaining authorized staff roster access and current management rules.

## Resolution of wording

The product reviewer proposed “Could not submit. Try again.” The accessibility/data reviewers highlighted an uncertain outcome after a lost connection. The panel's final spec uses “Could not confirm registration. Check your entries before retrying.” This avoids claiming the server rejected an operation whose outcome is unknown.

## Explicitly deferred

Overview/default-tab design, sign-in return, success follow-up, broader management grouping and actual roster-lock/eligibility semantics require their own journey design. API capability gaps remain recorded separately. The correction batch does not change API adapters, DTOs, hook implementations, backend, shared store or business rules.

## Verification limits

Automated correction evidence will be recorded after integration. Rendered 1280 × 800 and 1440 × 900 acceptance is pending because browser Computer Use access was denied. Live backend acceptance is pending because port 8000 has no listener. Mock preview remains available at http://127.0.0.1:5174/.

## Integrated outcome — 2026-10-05

All five correction tasks passed cross-review. A P2 background-refresh draft-loss issue was fixed by keeping the active form mounted and exposing source retries inside its dialog; a P3 Modal test gap was closed with a stable controlled harness. Final whole-source review found no remaining concrete findings. Root verification passed TypeScript, lint, 79 files / 537 tests, build and whitespace checks; Impeccable detector returned `[]`. Bundle-size warning and browser/live-backend acceptance remain recorded.

The user ended orchestration and requested direct work with Impeccable. No workers are active. The next role-journey audit dispatches failed before delivering findings due to the worker usage limit; those next-phase audits remain unperformed.
