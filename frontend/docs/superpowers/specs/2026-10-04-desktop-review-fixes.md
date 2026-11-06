# Desktop foundation review corrections

Date: 2026-10-04
Scope: frontend corrections agreed after three independent reviews and a panel discussion
Status: Implemented; automated verification and correction cross-review passed; rendered viewport acceptance pending

## Decisions

The panel confirmed three current-user problems: an expected Admin-access denial appears as failed work, green controls miss the light-theme text contrast floor, and failed feeds cannot be distinguished. Match action wording is ambiguous in the display contract, although current real-mode capabilities suppress those actions. Invitation deadlines can use existing response data. Long tournament titles are a static wrapping risk, not visually reproduced overflow.

All work remains under `frontend/`. Preserve backend endpoints, request/response shapes, DTOs, API adapters, and existing permission defaults. Do not infer missing Match capabilities. Changes remain uncommitted until requested.

## Required behavior

1. Home treats a confirmed `ApiError` 403 from the Admin-access probe as no Admin work. It does not show an error or Retry for that denied source and never enables Admin requests. Network/server failures still show a retryable feed error. Classify this locally in Home without changing the shared probe or API contract.
2. Each failed feed has descriptive frontend metadata: Team invitations, Team readiness, Referee invitations, Referee requests, Matches, Tournament setup, or Admin requests. Show this context beside Retry and include it in the button's accessible name. Two failures in the same domain remain distinguishable and each button calls only its own retry.
3. Active navigation and primary green controls have text contrast of at least 4.5:1 in explicit light, inferred light, and dark themes, including hover. Retain the existing LTMS green palette and visual identity.
4. Match cards distinguish `Review result`, `Review check-in`, and `Resolve dispute`. Preserve capability checks, keys, task ordering, and destinations. When dispute resolution and result verification are both available, retain one existing result-destination card and prioritize the dispute label.
5. Valid Team invitation cards show a concise English expiry detail from existing `expiresAt`, using the existing date-formatting conventions. Expired/invalid invitations remain excluded.
6. Apply scoped shrink/wrap rules to Tournament discovery titles to contain long unbroken names. This is preventive hardening; no rendered overflow reproduction has been established.
7. Correct the API coverage note: real Match lists are composed through the current adapter, which initializes capabilities to false. No real Home Match action is currently confirmed. Record the capability-data gap as a backend-delivery ticket; leave all API files and DTOs untouched.

## Verification and acceptance

- Render a Home with a rejected Admin probe (403), empty permitted feeds, and no Admin request: show the honest empty state with no Admin failure/retry. Verify unexpected probe failure remains retryable.
- Render simultaneous Team or Referee feed failures: show distinct visible source context and accessible Retry names; clicking one does not retry the other.
- Verify selector labels for result/check-in/dispute capabilities and invitation expiry detail.
- Run TypeScript, lint, full real-mode Vitest, production build, diff/scope checks, and one Impeccable detector pass after integration.
- Keep the 1280 × 800 / 1440 × 900 walkthrough in both themes pending until authorized browser inspection is available. Automated checks and calculated contrast do not establish rendered visual acceptance.

## Panel ruling

Prioritize denied-Admin state, contrast, and retry identity. Address short action wording and expiry in the same frontend correction batch. Document the Match limitation immediately. The long-title concern remains qualified as static evidence. Later role journeys and mobile adaptation retain their separate scope.
