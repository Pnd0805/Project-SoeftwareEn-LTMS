# Team name and role border refinement

User correction after `bddc402`: remove the white paper behind Team names, keep colored outlines and give Member teams a colored outline too.

- Removed title backgrounds and their padding from Teams list Leader names and Team detail headings. Kept Barlow sizes, the LEADER sticker and existing layout.
- Leader cards retain emerald outlines; Member cards now use A's amber token. Existing text labels continue to identify both roles.
- Frontend presentation only. All 49 frozen API/DTO/hook/store/rule hashes still match; no endpoints, handlers, permission conditions or payloads changed.

## Verification and review

- Team regressions: **7 files / 49 tests passed**.
- TypeScript via `npm run build`, production build, ESLint and whitespace checks pass. Existing bundle-size warning remains.
- Impeccable detector on TeamsPage: exit 0, no findings printed.
- Batched browser inspection at 1280×800 dark, 1440×900 light and 390×844 in both themes: title backgrounds are transparent, role outlines differ, no page-level overflow or page errors. Filtering, Team navigation, Invite players focus and a single active tab panel work.
- Team heading contrast: **11.32:1–15.81:1**; card outlines against their surfaces: **5.14:1–7.47:1**.
- Direct standards/spec review: scoped styles use existing tokens, role labels remain explicit and both list/detail title treatments match the correction. No blocking findings; no subagents spawned.

Evidence: [dark cards](team-role-colors/teams-1280-dark.png), [light mobile cards](team-role-colors/teams-390-light.png), [Team header](team-role-colors/team-1440-light.png), [checks](team-role-colors/checks.json).

Local mock preview: `http://127.0.0.1:5175/teams`. Live backend integration was not run for this visual correction. Unrelated inherited changes remain outside this refinement.
