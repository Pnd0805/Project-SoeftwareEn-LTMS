# Equal Team workspace panels

User-requested refinement from `ae6989a`: Members, Invites and Manage must have the same frame size.

- All three selected tab panels now use a full-width **440px** frame. The frame owns the outline and vertical scrolling; its existing child Panel keeps padding and content without a second outline.
- Long content scrolls inside the named, focusable tab panel. Short/empty content fills the same frame. The TeamRecord position stays fixed across tab switches.
- Existing hidden/inert panels, preserved drafts, shortcuts, dialogs, routes and permission conditions remain intact. Nonleader rosters retain their existing layout.

## Verification

- Team and Modal suite: **8 files / 63 tests passed**.
- TypeScript and production build via `npm run build`, ESLint and whitespace checks pass. Existing bundle-size warning remains.
- Impeccable layout scan before/after on TeamPage and TeamManage: `[]`.
- All **49 frozen API/DTO/hook/store/rule hashes match**. Only feature-scoped CSS changed at runtime.
- Batched inspection: 1280×800 dark, 1440×900 light, 390×844 both themes. Used 24 extra members in temporary browser fixture contexts, without changing production seed data.
- Computed selected-panel widths/heights: **1000×440**, **1132×440** and **342×440** respectively. Members / Invites / Manage match exactly in each viewport; their top and TeamRecord document positions also match. No page overflow or page errors.
- Focused PageDown scrolls the long roster within the frame. Invite shortcut focus, search draft retention, one visible panel and edit-dialog Escape/focus return pass.

Evidence: [Members](team-equal-panels/members-1280-dark.png), [Invites](team-equal-panels/invites-1280-dark.png), [Manage](team-equal-panels/manage-1440-light.png), [mobile](team-equal-panels/members-390-light.png), [computed dimensions and checks](team-equal-panels/checks.json).

## Direct review

Standards: existing tokens, scoped selectors, Thai rationale comment and installed Tabs infrastructure retained. The focused scroll region contains long content without nested outlines. No blocking findings.

Spec: all three frames have equal width and height, history stays in place, and existing behavior/permissions remain authoritative. No blocking findings. Review is by the implementer; no subagents spawned.

Local demo remains `http://127.0.0.1:5175/teams`. Live backend integration was not run for this layout-only refinement. Inherited unrelated changes remain outside the work.
