# 09: Verify desktop journeys and document the result

**What to build:** A verified desktop rollout and a durable record of the implemented visual system, with remaining integration gaps stated at their actual scope.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08A, 08B — all implementation slices. Acceptance runs against their combined code, after any separately authorized worktree integration.

**Status:** draft — ready for breakdown review.

- [ ] Review each changed journey at 1280 × 800 and 1440 × 900 in both themes, including long content and an open dialog.
- [ ] Check keyboard focus, status contrast, primary-action visibility and page-level overflow on rendered pages.
- [ ] TypeScript, lint, the full test suite and production build pass; the frozen API/DTO/hook/store/rule baseline matches.
- [ ] Every existing route is accounted for in the coverage inventory and material findings are resolved or explicitly reported.
- [ ] Document implemented design tokens and components; keep the approved prototype as local reference until its archival commit is authorized.
- [ ] Report browser or live-backend checks as pending if unavailable; automated checks alone do not complete rendered acceptance.

**Review entry:** Open the [spec and execution index](../../../docs/superpowers/tickets/2026-10-05-ltms-minimal-street.md), then Task 9 of the implementation plan.
