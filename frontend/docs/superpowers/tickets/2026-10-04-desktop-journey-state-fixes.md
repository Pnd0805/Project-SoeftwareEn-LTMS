# Desktop journey correction tickets

Source: companion spec and implementation plan dated 2026-10-04.
Status: Implementation, cross-review and automated integration complete; follows the user-authorized reviewer discussion → spec/tickets → implementation flow.

| ID | Priority | Correction | Acceptance |
|---|---|---|---|
| UX-J1 | P1 | Named keyboard-safe dialog | Focus skips hidden/disabled inputs, stays inside and returns to the opener |
| UX-J2 | P1 | Registration feedback | Announced unconfirmed network outcome; selections/count and payload retained |
| UX-J3 | P2 | Honest discovery/entry states | Applicable queries only; empty/404 distinguished from errors; isolated Retry; no unknown eligibility/capacity claims |
| UX-J4 | P2 | Independent Teams sources | Heading/available content survive other-source failures; retries stay isolated |
| UX-J5 | P2 | Team semantics and roster access feedback | h1, safe parent destination, contextual action names and applicable Guest states |

Broader journey proposals are explicitly deferred in the spec. Visual walkthrough and live backend checks remain separate acceptance tasks, currently blocked by unavailable approved browser access and no local backend listener.

## Verification — 2026-10-05

TypeScript, full ESLint, 79 test files / 537 tests, and production build passed. Final tests produced no act warnings. Impeccable detector returned no findings. The build reports chunks over 500 kB; performance measurement/code splitting remains a later optimization task. Frozen API/DTO/hook/store/rule files match the correction-batch baseline, and whitespace checks pass. Changes remain uncommitted.

The independent final source review passed with no remaining concrete findings. The registration draft-retention issue and Modal test gap were fixed and independently re-reviewed. Browser viewport and live-backend acceptance remain pending; this is not completion of the entire desktop/mobile UX program.
