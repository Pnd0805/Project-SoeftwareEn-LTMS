# Quality20 local integration — 2026-10-08

Target: `ltms-desktop-ux`. Both worker commits are incorporated into the target branch.

| Revision | Content |
|---|---|
| `29d1568` | Q10 and Q13–Q20 layout, shared semantics and mobile shell |
| `5e31ae7` | Q11–Q12 and Q21–Q22 interactions, moderation, fidelity and route recovery |
| `5210ebd` | Merge of the layout worker |
| `db01fa9` | Merge of the interaction/runtime worker |
| `68155bb` | Preserve inherited Report dialog styling |

The merge was prepared in `ltms-quality20-integration`, then fast-forwarded into `ltms-desktop-ux`. Three add/add conflicts were resolved: the plan retains the completed layout evidence; GlobalScanDialog and its test retain Q11's single error announcement and capture recovery. No new product behavior was introduced to resolve these conflicts.

## Preserved parent work

Before updating the target branch, all nine modified and 649 untracked parent files were copied and hashed. A Git stash also retains the exact original snapshot: `107949024906d785cbde509bdfc4a41ceb1af968` (`pre-Quality20 merge: preserve parent work 2026-10-08`).

642 files outside the integrated changes were restored with matching hashes. The other 16 paths were already incorporated or superseded by the reviewed worker implementation. The parent's Report styling was applied separately and committed as `68155bb`. Scan helpers, its existing useMatch dependency and Shell wiring are retained. Ticket09 acceptance, design records and original review artifacts are preserved in the documentation cleanup.

No backend files, API adapters or DTO definitions changed. The inherited useMatch QR wrapper matches the parent snapshot; it was included as an existing Scan dependency. Existing permissions and payload behavior are covered by the passing contract and interaction tests.

## Source gates on the target branch

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npm run lint` | exit 0 |
| `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run --maxWorkers=2` | exit 0; 105 files / 760 tests |
| `npm run build` | exit 0 |

The suite retains two existing jsdom `scrollTo` notices. The production build retains Vite's >500 kB raw chunk warning; main JS is 524.85 kB raw / 156.48 kB gzip. A separate command-local mock production build was used for isolated production route checks. No live backend was accessed.

## Fresh integration browser checks

[Evidence index](../../../reviews/2026-10-08-quality20-integration/README.md).

| Check | Completed records | Scope |
|---|---:|---|
| Q11 | 6 | Camera denial, invalid code and Profile retry |
| Q12 | 40 | Deliberate Register draft and contextual moderation, including failure/restore |
| Q22 | 59 | Production chunk loading/failure/reload, existing route forms and anonymous access |
| Mobile/shared shell | 88 | Guest, Player, Team Leader, Organizer, Referee, Admin and Bracket; 320/390px and representative desktop widths, both themes |
| Mobile interactions | 24 | Four width/theme cases; keyboard, resize, Search/Inbox, theme, secure-origin failure, native file chooser, long account and doubled header text |

The shell checks report zero page overflow. Representative Scan, moderation, mobile Team and chunk-failure captures were visually inspected. Fixtures use isolated browser contexts, mock stores or intercepted responses.

The initial mobile interaction runner waited for the old standalone “Camera unavailable” label. Q11 intentionally replaced duplicate status/error text with one alert. The runner now checks that alert, absence of stale status, manual code input and Retry camera. Its observed failing run is preserved; the corrected run exited 0. Product source was unchanged for this correction.

## Current ticket state

- Q10–Q11 and Q13–Q22: frontend implementation integrated with the worker evidence and fresh integration checks.
- Q12: frontend implemented; historical Feedback restoration still needs a supported lookup. See `FEAT-1-REMAINING.md`. No synthetic lookup or result was added.
- Q23: source gate complete; full route/role/state scorecards and remaining rendered acceptance are open. Integration checks do not establish the formal >=18/20 release scores.
- Physical iPhone safe area, actual camera permission/QR capture and native photo capture remain unverified. Live backend and active voting/streaming acceptance remain unverified.

Merged local preview: `http://localhost:5185`, explicit mock mode. The source worktrees and their existing previews are retained. No push or deployment was performed.
