# R01/R02 P1 fixes — 2026-10-08

Approved scope: the two P1 findings from the merged Quality20 review; mobile Admin option B, collapsible section navigation. Starting HEAD `c0d579c`. Earlier review scores remain a historical sample; this focused fix verification does not assign new app-wide scores or close Q23.

## Changes

- Badge text on ruby/teal fills uses `--accent-ink`; fills and `--ink` outlines retain the approved identity.
- Mobile Admin exposes Sections plus the current route. Its ten grouped destinations open on demand; selecting one collapses the navigation and focuses the workspace. Desktop retains all destinations. Media-query listeners are removed on unmount; modifier-click link behavior is retained.
- Hidden navigation is excluded from display and keyboard/assistive navigation; no duplicate destination tree is rendered.
- No API adapters, DTOs, schemas, hook contracts, authorization or mutation payloads changed.

## Before/after

Same isolated contexts and fixtures at 320×844, 390×844, 700×844, 701×844, 1280×800 and 1440×900, dark/light, for Home, Team and Admin. All network API traffic is aborted or intercepted; no live backend or visible Chrome. Browser contexts close in finally blocks; existing preview 5185 remains running.

| Measurement | Before | After |
|---|---:|---:|
| Light unread/ruby text | 3.42:1 | 5.18:1 |
| Light W/teal text | 3.15:1 | 5.63:1 |
| Lowest tested dark badge ratio | 5.23:1 | 5.23:1 |
| Admin 390px queue heading | y966.14 | y403.36 |
| Admin 390px first Approve top, long-name fixture | y1408.39 | y845.61 |
| Admin 320px queue heading | y966.14 | y403.36 |
| Browser acceptance records | 36 with 50 failed measurements/requirements | 36; zero failures |

The selected queue is now visible initially; very long request cards still need ordinary scrolling to their actions at narrow widths. No claim is made that every action fits in the initial viewport.

[Before measurements](before/measurements.json) · [After measurements](after/measurements.json) · [Mobile Admin](after/admin-390-light.png) · [Desktop Admin](after/admin-1440-dark.png) · [Light unread badges](after/home-1280-light.png).

The Team fixture inserts an L marker only when the isolated seed has exclusively W results; it exercises the actual shared loss style and does not change production data. Mobile unread badges are inspected inside the existing navigation menu; desktop also inspects the notification bell.

Run from frontend: `node docs/reviews/2026-10-08-quality20-p1-fixes/check-p1.cjs after`. `QUALITY20_ORIGIN` can override the existing mock server. The first baseline runner attempted to wait for desktop-only badge DOM on mobile and timed out; opening the actual mobile menu corrected that fixture assumption before any product edit. The completed baseline then failed for the two observed P1 defects as expected.

## Source gates

| Check | Result |
|---|---|
| New Admin regression cases before code change | 3 fail; 13 existing cases pass |
| Admin focused suite after change | 16/16 pass |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npm run lint` | exit 0 |
| `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run --maxWorkers=2` | exit 0; 105 files, 763 tests |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0 |

The two existing jsdom scrollTo notices and >500kB raw entry-chunk build warning remain. Main JS remains 524.85kB raw / 156.48kB gzip. No fresh browser-wide grade or performance claim is inferred from this build.

Impeccable detector ran once over AdminPage and the shared stylesheet: 73 existing advisory findings (72 font-size, one decorative crest radius) in [detector.json](detector.json); no non-advisory findings and none for the new Admin control. Existing typography/radius record drift was not changed as part of these fixes.

Physical iPhone, live backend, active MVP/Watch and the remaining P2/P3 findings stay outside this selected fix scope. Q23 release acceptance remains open.
