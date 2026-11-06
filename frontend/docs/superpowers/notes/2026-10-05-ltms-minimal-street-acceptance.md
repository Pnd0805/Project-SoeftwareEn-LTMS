# Minimal Street — desktop acceptance

Date: 2026-10-07. Branch: `ltms-desktop-ux`. Combined implementation base: `4130a3d5eec7356b1b74d95ac403579225cd8447`.

**Ticket 09 complete at the documented frontend acceptance scope.** All routes are accounted for, fresh developer gates pass, both desktop sizes/themes and narrow usability were rendered, and the design record is written. This is direct implementer review, not independent review. Live backend/device acceptance and a full mobile redesign remain open. The Ticket 09 changes are uncommitted; no push, deployment, worktree cleanup or prototype archival was performed.

## Evidence and method

- Fresh Chromium/Playwright runs used the merged checkout: user mock preview at `http://127.0.0.1:5175`, temporary real-mode preview at `http://127.0.0.1:5176` with every `/api/v1/` request intercepted. No live backend was read or mutated.
- Viewports: **1280×800, 1440×900 and 390×844**, each dark/light. [Route/journey batch](ticket-09/checks.json): 258 records; [supplemental states](ticket-09/states.json): 30 records; [bounded confirmation](ticket-09/confirmation.json): 18 records; [legacy ID DOM confirmation](ticket-09/route-id-confirmation.json): 12 records. Total: **318 records, 282 screenshots**. Retained bootstrap captures are excluded from acceptance counts.
- One detector invocation on 77 UI TSX/CSS targets; one initial batched visual inspection, one correction batch, one confirmation. [Detector result](ticket-09/impeccable-detector.json), [invocation targets/exit](ticket-09/impeccable-detector-run.json), [desktop contact sheet](ticket-09/desktop-inspection.jpg), [narrow contact sheet](ticket-09/narrow-inspection.jpg), [confirmation contact sheet](ticket-09/confirmation-inspection.jpg).
- No page-level horizontal overflow or unnamed main-content buttons in the captured pages; no pageerror events in the route/state batches. Long Profile names, Search results, Inbox text, Organizer registrations, Admin queues and Referee statistics were rendered with synthetic fixtures. This is sampled acceptance, not an exhaustive WCAG or browser compatibility certification.
- The initial keyboard metrics sampled before Base UI/browser focus settled, giving false negatives. A diagnostic Tab trace and the final confirmation wait for focus settlement: **12 consecutive Tabs stay in the dialog, Escape closes, focus returns to Decline**, for all six viewport/themes. Skip link focus and activation into main pass. The initial raw metrics remain retained rather than overwritten.
- The initial mock bootstrap used only the legacy session, leaving `/me` unauthenticated. It was stopped before visual inspection; those captures are retained under `ticket-09/bootstrap-harness/` and excluded. The accepted batch sets the existing mock identity as well as its legacy bridge. These were harness defects, not product fixes.

## Source gates after the correction

| Gate | Result | Fresh log |
| --- | --- | --- |
| `npx tsc --noEmit -p tsconfig.app.json` | Exit 0 | [TypeScript](ticket-09/typescript.log) |
| `npm run lint` | Exit 0 | [Lint](ticket-09/lint.log) |
| `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run --reporter=dot` | **96 files / 655 tests passed**, exit 0 | [Vitest](ticket-09/vitest.log) |
| `npm run build` | Exit 0 | [Build](ticket-09/build.log) |
| Frozen filenames + SHA-256 | **All 49 equal the phase baseline** | [Hash evidence](ticket-09/frozen-hashes.txt) |

[Gate accounting](ticket-09/source-gates.json). Test output retains the jsdom `Window.scrollTo` warning; actual browser checks use real scroll/focus. Production build retains its >500kB warning: main 941.83kB (269.19kB gzip), secondary esm 477.55kB (125.22kB gzip). Build time/chunk sizes are not a measured network performance budget.

The product patch changes only report-dialog presentation in `LiveCommunityTab.tsx`: missing `--warn` becomes a 1px amber outline; undefined selected surface/fallback outline become existing `panel-3`/`line-hot`; reason-option corners use the shared 2px token. Report payload, comment ID, permissions, cancellation and mutation handling stay at the existing contract. The full regression suite covers report confirmation/cancellation and moderation behavior. No CSS-string unit tests were introduced.

## Complete route inventory

Each pattern is rendered in all six viewport/themes. Auth pages are special-cased before Guard/Shell. The wildcard is exercised as a redirect. Dynamic routes do not imply new permissions or new identifier contracts.

| App route | Owning ticket | Representative audience/state | 1440 dark evidence |
| --- | --- | --- | --- |
| `/` | 01 | Signed-in Leader: bounded tasks and truthful missing next match | [Capture](ticket-09/mock-0-1440-dark.png) |
| `/home/:tab` | 02 | Player: public discovery | [Capture](ticket-09/mock-1-1440-dark.png) |
| `/t/:id` | 04 | Player: public Tournament overview | [Capture](ticket-09/mock-2-1440-dark.png) |
| `/t/:id/:tab` | 04 | Player: public Schedule | [Capture](ticket-09/mock-3-1440-dark.png) |
| `/t/:id/:tab/:sub` | 05 | Owner Organizer: registrations management | [Capture](ticket-09/mock-4-1440-dark.png) |
| `/m/:id` | 06 | Assigned Referee: confirmed Match | [Capture](ticket-09/mock-5-1440-dark.png) |
| `/m/:id/fixture` | 06 | Player: denied Organizer fixture form | [Capture](ticket-09/mock-6-1440-dark.png) |
| `/m/:id/:tab` | 06 | Assigned Referee: statistics tab | [Capture](ticket-09/mock-7-1440-dark.png) |
| `/checkin/:id` | 06 | Referee: closed/check-in summary; open QR confirmed separately | [Capture](ticket-09/mock-8-1440-dark.png) |
| `/mvp/:id` | 06 | Player: missing Tournament ID plus valid legacy Tournament DOM confirmation | [Capture](ticket-09/mock-9-1440-dark.png) |
| `/team/:id` | 03 | Leader: members and supported management | [Capture](ticket-09/mock-10-1440-dark.png) |
| `/player/:id` | 03 | Player: public career and Teams | [Capture](ticket-09/mock-11-1440-dark.png) |
| `/watch/:id` | 06 | Player: missing Tournament ID plus valid legacy Tournament DOM confirmation | [Capture](ticket-09/mock-12-1440-dark.png) |
| `/search` | 08B | Player: blank search | [Capture](ticket-09/mock-13-1440-dark.png) |
| `/search/:q` | 08B | Player: populated local search | [Capture](ticket-09/mock-14-1440-dark.png) |
| `/register` | 08A | Signed out: account form | [Capture](ticket-09/mock-15-1440-dark.png) |
| `/login` | 08A | Signed out: sign-in form | [Capture](ticket-09/mock-16-1440-dark.png) |
| `/teams` | 03 | Leader: leader/member Team frames | [Capture](ticket-09/mock-17-1440-dark.png) |
| `/matches` | 06 | Assigned Referee: working queue | [Capture](ticket-09/mock-18-1440-dark.png) |
| `/inbox` | 08B | Player: mock Inbox, real Action requests captured separately | [Capture](ticket-09/mock-19-1440-dark.png) |
| `/me` | 08A | Player: Profile, long-name real fixture captured separately | [Capture](ticket-09/mock-20-1440-dark.png) |
| `/request` | 05 | Player: Organizer request form | [Capture](ticket-09/mock-21-1440-dark.png) |
| `/admin` | 07 | Admin: request queue | [Capture](ticket-09/mock-22-1440-dark.png) |
| `/admin/:tab` | 07 | Admin: user directory | [Capture](ticket-09/mock-23-1440-dark.png) |
| `*` | 01 | Player: unknown route redirects Home | [Capture](ticket-09/mock-24-1440-dark.png) |

`/mvp/:id` and `/watch/:id` retain **Tournament** IDs. Initial mock captures use a Match ID and exercise their missing-record state; [follow-up DOM confirmation](ticket-09/route-id-confirmation.json) checks `/mvp/t-fb` and `/watch/t-fb` in all six viewport/themes. Real per-Match voting remains `/m/:id/mvp`; the prior [Ticket 06](2026-10-06-ltms-ticket-06.md) evidence covers candidates/window states. No route meaning was changed.

### Permission and data states

- Guard admits documented public destinations and requires authenticated `/me` for Teams, Matches, Inbox, Profile, Request and Admin. Guest Admin redirects to Login in every fresh viewport/theme capture.
- Sidebar destinations remain based on current access probes; an Admin-looking display role does not create a server grant. Existing scoped Admin tests and Ticket 07 evidence remain the acceptance for faculty/university queues.
- Organizer and Team Leader management retain ownership/capability checks. The fixture route remains denied for a player. No new permissions are inferred from glossary labels.
- Fresh real-mode Search partial failure shows Retry teams while keeping successful Tournament results. Fresh denied Inbox hides notification rows and keeps separately permitted Action requests. Neither failure becomes an empty-success claim.
- Existing regression gates and prior Ticket 04/05/06/07/08A/08B notes retain detailed loading, empty, pending, denied-cache, retry, draft and disappearing-row receipt evidence; this ticket adds merged rendering and source gates, not a claim that every mutation was performed live.

## Keyboard, color and responsive findings

- Fresh shared-dialog focus containment, Escape and return focus pass after asynchronous focus settles. Tournament preview closes with Escape; reduced-motion samples report animation `none` and transition `0s`. Prior preview regression coverage preserves filters/query parameters and return focus.
- [18 sampled token contrast pairs](ticket-09/contrast.json) pass their recorded thresholds: normal text/action labels ≥4.5:1, sampled focus/status accents ≥3:1. Bone-faint on panel-3: dark 5.035:1, light 5.012:1. Primary label/fill: dark 7.132:1, light 5.634:1. This covers solid normative pairs, not every textured/alpha-composited pixel or placeholder.
- Open Check-in QR is rendered during `checkin_open` in the confirmation batch. Both themes use the same actual SVG fills: `rgb(229,220,200)` and `rgb(10,8,16)`; **14.598:1**. Physical camera focus, glare, decoding and authenticated server submission remain device/live acceptance.
- Home's two 320px bodies keep Tournament discovery below a bounded task queue. Working grids/tables stay inside their regions at narrow width. Narrow mode is retained usability, with stacked navigation and longer pages, not completion of the future mobile design.

## Bounded Impeccable audit

Scores follow the skill's five dimensions, 0–4 each. These are this implementer's sampled judgments, not independent reviewer ratings.

| Dimension | Score | Evidence and limitation |
| --- | --- | --- |
| Accessibility | 3/4 | Keyboard/labels/solid contrast checked; no screen-reader or complete pixel/placeholder audit |
| Performance | 3/4 | Source/build gates pass; large main bundle and no throttled network measurements |
| Responsive | 3/4 | Both desktop targets and 390px usability pass; full mobile redesign remains separate |
| Theming | 4/4 | Both palettes, corrected dialog states and fixed scanner colors verified |
| Implementation integrity | 3/4 | Frozen contracts and existing regression suite preserved; legacy report reason UI still exceeds the write contract |
| **Total** | **16/20** | No P0/P1 found in this bounded pass; P2/P3 follow-ups below |

### Detector disposition

1. **Broken image — false positive.** `EvidencePreview` starts with `<img ref>` and assigns the blob URL in its effect, revoking it on cleanup. The detector cannot follow this lifecycle. Existing Match evidence tests pass; no image code or detector suppression was added.
2. **Side accent border — corrected (P2).** The report quote referenced nonexistent `--warn` and requested a 3px side accent. It now uses a valid 1px amber outline. The same correction batch resolves undefined selected background and fallback border tokens, with shared corners. Confirmation records actual border/background/corner values in both themes.

### Explicit remaining findings and acceptance gaps

| Priority | Finding | Next action / scope |
| --- | --- | --- |
| P2 | Main bundle remains >500kB | A separately scoped performance ticket can measure cold-route loading before deciding on splitting; no dependency/config change in Ticket 09 |
| P2 | Legacy comment Report popup asks for category/detail, but the existing report mutation sends only comment ID | Clarify the frontend confirmation to match the delivered API, or agree a backend contract before transmitting a reason. Ticket 09 preserves that frozen contract and does not claim a reason is delivered |
| P3 | Report popup retains verbose bilingual presentation; long content requires internal scrolling | A copy/interaction follow-up can simplify page-owned wording and radio presentation under the same API boundary |
| Acceptance gap | No populated live backend journey tested here | Follow CLAUDE preparation/role audit, then verify registrations, referee consent/start/results, moderation, Inbox receipts, Profile reload and MVP windows with authorized backend fixtures |
| Acceptance gap | No physical QR camera/scanner acceptance or full mobile design | Keep device verification and the future mobile phase separate |

No new Ticket 10 was created. The current Minimal Street index ends at 09. These follow-ups are reported scope, not silently scheduled implementation or permission to change the API.

## Design record and retained references

- [DESIGN.md](../../../DESIGN.md): normative frontmatter with 56 actual palette entries including light overrides, typography, 4px spacing/corner scales and component variants; canonical eight prose sections describe the implemented B/A direction.
- [Impeccable sidecar](../../../.impeccable/design.json): schemaVersion 2, nine standalone visual snippets, exact document narrative and metadata. Eight-step OKLCH ramps are derived display metadata; they do not add runtime CSS colors or new product tokens.
- Shared React kit/API boundaries remain authoritative for runtime behavior; sidecar snippets are visual examples.
- `src/features/home/Home.prototype.html`, its assets, previous ticket evidence, both completed worker worktrees and pre-integration backup are retained. No archival/delete operation was authorized or performed.

Standards review: frontend-only change, existing tokens, no dependency or API changes, scoped evidence and short guidance; no new blocking deviation found. Spec review: all five Task 9 steps have concrete artifacts, findings are either corrected or explicitly reported, and live/mobile/device gaps remain open at their real scope.
