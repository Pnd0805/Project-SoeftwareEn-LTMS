# Leader cards and Team workspace tabs

Implemented the user-approved Ticket 3 follow-up directly from `aac49fe`.

## Delivered

- Leader teams have a larger Barlow paper title, emerald outline and one tilted LEADER sticker. Member cards, ordering, local filters and existing actions retain their behavior. Both themes use the existing A palette.
- Leader Team details default to Members, with Members / Invites / Manage tabs above the workspace. Only the selected panel is visible. Installed Base UI Tabs provide linked labels, arrow-key activation and roving focus; hidden panels are inert and excluded from keyboard/accessibility navigation.
- Keep panels mounted to retain invitation drafts and mutation notices across switches. A keyed TeamDetails boundary resets the workspace when the team or viewing permission changes; revoked Leader access removes private panels immediately.
- Invite players opens Invites and focuses the search, including repeat clicks while that tab is active. Existing roster locks and source-success conditions remain authoritative.
- Nonleaders and Guests keep their existing roster presentation. TeamRecord remains below the workspace, with its existing mock-only boundary.

## Verification

- Red: the new default/one-panel test failed because the previous page had no tabs. Green: that test and the existing TeamPage cases passed after implementation.
- Team, Player and Modal regression suite: **9 files / 64 tests passed**. Additional cases cover retained search drafts, arrow-key selection, hidden controls, permission revocation and restored access starting from Members.
- Full working-tree suite: `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run --reporter=dot` — **84 files / 581 tests passed**.
- TypeScript, ESLint and production build pass. The existing bundle-size warning remains.
- Staged commit snapshot also passes TypeScript and the 9-file / 64-test Team/Player/Modal suite without unrelated inherited changes.
- All **49 frozen API/DTO/hook/store/rule files match** the captured phase baseline. No API or hook edits were made.
- Impeccable detector: changed Team sources, exit 0 with no findings printed.

## Rendered inspection

One initial inspection and one confirmation batch: desktop 1280×800 dark and 1440×900 light, mobile 390×844 in both themes, plus long unbroken names. Verified one visible panel, retained search, header shortcut focus, arrow keys, Tab into the selected panel, member-only presentation, and removal-dialog Escape/focus return.

The initial browser check found Base UI briefly retaining the previous panel while its transition completed. Scoped CSS now hides inert panels immediately. Confirmation has no page-level horizontal overflow or page errors. New title/sticker/tab text contrast ranges from **5.63:1 to 14.60:1**.

- [Leader cards, dark](team-leader-tabs/teams-1280-dark.png) and [light](team-leader-tabs/teams-1440-light.png)
- [Members](team-leader-tabs/members-1280-dark.png)
- [Invites](team-leader-tabs/invites-1280-dark.png)
- [Manage](team-leader-tabs/manage-1440-light.png)
- [Mobile workspace](team-leader-tabs/manage-390-light.png)
- [Long Team name](team-leader-tabs/long-teams-390-dark.png)
- [Browser checks and computed contrast](team-leader-tabs/checks.json)

## Review

**Standards:** direct review of the scoped diff against frontend AGENTS.md, CLAUDE.md and the code-review smell baseline. Feature-scoped CSS, existing dependencies, Thai rationale comments and frontend boundaries are preserved. No blocking findings.

**Spec:** the approved Leader treatment and three-tab workspace are implemented, including draft retention, default Members, shortcut focus and role restrictions. TeamRecord stays below the workspace. No blocking findings.

This is implementer review; the user stopped orchestration, so no independent reviewers were spawned. Unrelated inherited Search, Request and Tournament changes remain outside this follow-up. Backend integration was not exercised against the teammate's live service; checks establish frontend behavior with existing fixtures and the local demo at `http://127.0.0.1:5175/teams`.
