# Home follow-up — Needs you / Next match

User approved the bounded 50/50 Home design on 2026-10-05. This refines Ticket 01; Tickets 02–09 remain pending.

## Behavior

- Desktop: equal left/right columns with 24px separation. Needs you stays left, Next match right. At 820px and below they stack in that order.
- Next match reuses the existing personal Match query already consumed by real Home. No API, DTO, hook, store or rule file changed; all 49 frozen hashes still match.
- Select the nearest upcoming scheduled/check-in-open Match with valid schedule and named participants. Show known Tournament, teams, absolute local date/time with timezone, venue (or Venue not set), and the existing /m/:id destination.
- Loading, failure/retry and empty schedule remain distinct. Retryable refresh failures retain known content; 401/403 removes the cached Match from the preview. Time selection updates every minute without another request.
- Guest Home and the Tournaments destination do not mount the personal workspace. Mock Home uses the existing mock personal Match API; no production sample fixture was added.

## Verification

- Initial new component test failed because the component did not exist. The elapsed-kickoff case subsequently failed before the clock update was implemented.
- Full working-tree regression run before the clock correction: 81 files / 550 tests passed. Final affected Home/layout run after the correction: 11 files / 73 tests passed, including 8 new selection/navigation/state/access/clock cases.
- TypeScript, lint and production build pass. Existing bundle-size warning remains.
- Impeccable markup detector: exit 0, no findings. Direct standards/spec review: no blocking findings; review is by the implementer, following the user's no-subagent instruction.
- Browser inspection and confirmation: 1280×800, 1440×900 and 390×844, both themes. Desktop columns measure 488/488 and 554/554; mobile one column 342px. No horizontal overflow or page errors. The first confirmation script timed out on a text locator; a fresh-login run with the named region/status locator completed successfully. View match opens /m/553103 for the test fixture.

## Rendered evidence

The populated screenshots use an isolated browser fixture with an explicitly future date (2099) and long team names to exercise layout. This changed only that browser context's mock storage; source seed, live backend and user browser storage were not modified. The current unmodified demo has no qualifying upcoming Match and correctly shows the empty state.

- [1280 light — test fixture](home-next-match/next-1280-light.png)
- [1440 dark — test fixture](home-next-match/next-1440-dark.png)
- [Mobile dark — test fixture](home-next-match/next-390-dark.png)
- [Unmodified demo loading state](home-next-match/next-empty.png)
- [Measurements](home-next-match/render-results.txt)

Live backend verification remains unavailable. API payloads and routes are unchanged; real-mode query behavior is covered by fixtures rather than a live backend claim.
