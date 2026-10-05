# Desktop foundation review panel

Date: 2026-10-04
Review state: uncommitted working tree on `ltms-desktop-ux`, based on `dcaac62b052b1e5d246e3bac516bc40f455f7257`

Three Sol 6.1 High agents independently reviewed accessibility, permissions/data contracts, and product UX. All performed read-only source reviews. Each then received the combined findings and returned priorities and qualifications. No browser inspection was claimed.

| Finding | Discussion outcome | Coordinator ruling |
|---|---|---|
| Expected Admin scope denial appears as failed work | All agree P2; the real probe throws on 403, while the prior denial fixture returned an unreachable false value | Correct Home classification locally and exercise the rejected probe |
| Light-theme text on green controls is below 4.5:1 | All agree P2; declared ink/teal pair measures 3.15:1 | Correct theme foregrounds without changing green palette |
| Failed feeds are visually/accessibly indistinguishable | Accessibility and product rate P2; permissions rates P3; visible and accessible observations overlap | One P2 ticket for descriptive feed identity and isolated retries |
| Match Review actions have identical subjects | Accessibility/product rate display contract P2; permissions rates P3 because currently dormant in real mode | Clarify short labels while preserving capabilities and destinations |
| Invitation expiry omitted | All agree P3 and existing expiresAt is sufficient | Add concise deadline detail from existing response |
| Long Tournament title token may overflow | Source-only risk; no rendered reproduction; baseline code | Add scoped preventive wrapping, retain pending visual acceptance |
| Real Match capability coverage claimed inaccurately | Adapter initializes flags false; mocked selector tests do not establish real task coverage | Correct note and record backend gap; preserve false defaults and all API contracts |

The correction batch is defined in `../specs/2026-10-04-desktop-review-fixes.md` and `../tickets/2026-10-04-desktop-review-fixes.md`. Prioritize Admin denial, contrast, and retry identity, then copy and documentation. Existing endpoints, DTOs and API adapters remain outside this batch.

Acceptance still needs an authorized walkthrough at 1280 × 800 and 1440 × 900 in both themes. CUA previously refused Safari access; no restriction was bypassed. Later role journeys and mobile remain separate phases.

## Correction review result

The three reviewers implemented disjoint frontend tickets and then reviewed another worker's changes: accessibility reviewed Home behavior, product reviewed visual rules, and permissions reviewed domain copy/documentation. All three cross-reviews reported no remaining findings. Required integration gates pass, including 75 test files / 455 tests. API adapter and DTO diffs remain empty. Full rendered viewport acceptance and the real Match capability-data gap remain explicit limitations.
