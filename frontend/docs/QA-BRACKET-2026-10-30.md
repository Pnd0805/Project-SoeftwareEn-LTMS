# Bracket readability — 30 October 2026

Branch: `ui-polish-s34`. Starting commit: `28d4d6d`.

## Delivered presentation

- Compact two-row match cards with team crests/names, a separate fixed-width score column and a green winning row using existing theme tokens.
- Column headings share a top baseline. Only the match bodies distribute vertically, so later rounds align with their feeders instead of moving the headings down the column.
- Status, special outcomes (including BYE/W/O) and Bangkok schedule times remain available below the team rows. Missing scores stay `—`; missing times stay `Time TBC`.
- Double elimination uses the existing `GET /tournaments/:id/bracket` metadata to separate upper/lower lanes and place Grand final after the upper final. Match IDs join to the current match list for teams and scores; stale team slots in bracket metadata are never used.
- Failed layout reads retain the match list and provide retry. Unmatched current matches remain visible under Other matches. A null round is not presented as Round 0.
- Winner connectors use existing `nextMatchId`, including lower-final progression to Grand final. They attach to the team rows and refresh after same-size data changes, regrouping, highlighting and resize. Round robin does not receive advancement lines.
- Match navigation, independent team links, keyboard focus, horizontal scrolling and local team highlighting remain available. Long names truncate with full names on hover/accessibility labels.

## Scope

All implementation edits for this task are under `frontend/`. Existing API paths, write payloads, permissions and progression rules are retained. The new read hook uses the supported bracket endpoint only for real double-elimination layouts and shares the existing `matches` invalidation namespace.

The database fixture files were already modified when this task resumed. The user subsequently requested separate frontend and backend/database commits. Those existing database changes were reviewed and committed separately as `5ca75ab` without further content edits; they are not part of the frontend implementation.

## Verification

- Tournament regression suite: **26 files / 184 tests passed**.
- Frontend TypeScript, lint and production build: passed.
- Initial full regression run: **154 files passed, 1 file failed; 1,176 tests passed, 1 timed out**. The existing dense QR-camera test exceeded its default 5-second limit while the production build ran concurrently.
- Isolated QR-camera rerun: **1 file / 1 test passed**; actual test duration 392ms. No QR source or test timeout was changed.
- Final full regression run without a concurrent build (`npx.cmd vitest run --maxWorkers=2`): **155 files / 1,177 tests passed**, including the QR-camera test. No source or test timeout adjustment was needed.
- `git diff --check`: passed.
- Database static checks: canonical fixture matches both embedded SQL blocks exactly; `seed-demo.py` parses and references it. No SQL was executed and no database was restored by this verification.

## Acceptance boundaries

Fresh visual browser verification remains pending. `cua.getState()` returned both “The browser access host is unavailable” and “Computer Use native pipe is unavailable”. Rendered component assertions use React Testing Library/jsdom; they do not verify pixel geometry, device behavior or a live backend response.

No push is requested or performed. `frontend/TODO/` is excluded from commits.
