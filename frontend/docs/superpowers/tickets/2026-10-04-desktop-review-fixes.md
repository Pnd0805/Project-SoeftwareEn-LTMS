# Desktop review follow-up tickets

Source: `../specs/2026-10-04-desktop-review-fixes.md`
Status: Frontend corrections implemented and verified; browser acceptance and backend-delivery gap remain pending

| ID | Priority | Work | Acceptance | Ownership |
|---|---|---|---|---|
| UX-R1 | P2 | Classify expected Admin probe denial locally on Home | Actual 403 yields no Admin error/retry or request; unexpected failures remain retryable | Home behavior |
| UX-R2 | P2 | Distinguish every failed feed visibly and accessibly | Simultaneous same-domain failures have descriptive names and isolated retry callbacks | Home behavior |
| UX-R3 | P2 | Correct text on green surfaces across themes | Active nav and primary controls meet 4.5:1, including hover; palette retained | Shared visual |
| UX-R4 | P2 display contract | Name Match review subjects | Result, check-in, and dispute labels are distinct; capabilities/destinations unchanged | Domain copy |
| UX-R5 | P3 | Show available invitation deadline | Valid invitations have concise expiry detail; expired invitations stay absent | Domain copy |
| UX-R6 | Preventive/static risk | Contain long Tournament title tokens | Scoped wrapping/shrink rules; rendered viewport acceptance remains pending | Shared visual |
| UX-R7 | Documentation | Correct real Match coverage claims | Actual composed data sources and false capability defaults documented | Domain documentation |
| BE-GAP-R1 | Backend delivery required; deferred | Existing Match list lacks confirmed action capabilities | Frontend continues suppressing unsupported actions; record gap only, no API implementation | Backend team follow-up |
| QA-R1 | Pending tool access | Desktop walkthrough at both sizes/themes | First viewport actions, focus, long names, and overflow visually verified | Acceptance |

## Execution plan

- [x] Home behavior: R1 and R2, rendered regression cases first.
- [x] Shared visual: R3 and R6, theme color calculations and scoped styles.
- [x] Domain copy/documentation: R4, R5, R7 and backend-delivery record, selector behavior cases first.
- [x] Integrate disjoint changes and run required frontend gates.
- [x] Read-only correction review; record resolved findings and remaining acceptance gaps.

## Verification

TypeScript, lint, real-mode Vitest (75 files / 455 tests), production build, tracked/untracked whitespace checks and scope checks pass. Build retains its bundle-size advisory. Impeccable detector returns `[]`. Three read-only cross-reviews report no remaining findings in the correction tickets. Local preview responds HTTP 200 at `http://127.0.0.1:5174/`.

There are no changes under `src/api/` or `src/types/`. QA-R1 remains pending because authorized browser inspection was unavailable. BE-GAP-R1 is recorded for backend delivery; no capability is inferred or fabricated.

API adapters under `src/api/`, DTOs under `src/types/`, backend code, shared store, and shared business rules are outside this correction batch. No commit or push is part of these tickets.
