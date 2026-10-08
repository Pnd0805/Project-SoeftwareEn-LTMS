# Quality20 merged verification

Fresh checks against `ltms-desktop-ux` source revision `68155bb`; [integration ledger](../../superpowers/notes/quality20/2026-10-08-integration.md). The formal per-surface /20 Q23 scorecards remain open.

[Q23 route/role/task inventory and remaining acceptance gates](Q23.md).

| Evidence | Records |
|---|---:|
| [Scan and Profile recovery](q11/q11-browser.json) | 6 |
| [Register and moderation](q12/q12-browser.json) | 40 |
| [Production route loading and recovery](q22/q22-browser.json) | 59 |
| [Shell layout and keyboard](mobile-shell/measurements.json) | 88 |
| [Mobile interactions](mobile-interactions/interactions.json) | 24 |

Representative inspected captures: [Scan recovery](q11/q11-denied-390-light.png), [moderation confirmation](q12/q12-comment-confirm-1440-light.png), [mobile Team](mobile-shell/leader-390-light.png), [production chunk failure](q22/q22-chunk-failure-1440-dark.png).

Run `node docs/reviews/2026-10-08-quality20-integration/check-integration.cjs <mode>` from frontend. Modes: `q11`, `q12`, `mobile-shell`, `mobile-interactions`, `q22`. Set `QUALITY20_ORIGIN` for another merged mock dev server. Q22 also requires `QUALITY20_MOCK_DIST`, an absolute path to a build generated with `VITE_USE_MOCK=true`. The runner reuses existing isolated fixtures and writes new evidence here.

The initial mobile interaction failure was an outdated exact-text assertion; [initial result](mobile-interactions/initial-run-result.json) is preserved. The corrected check verifies Q11's single alert and recovery controls; [final result](mobile-interactions/run-result.json) has exit code 0. No application code was changed for this check correction.
