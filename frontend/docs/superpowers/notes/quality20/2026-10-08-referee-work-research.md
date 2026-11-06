# Referee work: research and redesign

2026-10-08. User requested another Q15 design pass after finding the first Referee work implementation unsatisfactory. This remains frontend presentation of the existing assigned match queue. Preserve LTMS Minimal Street, desktop first, two desktop columns/one mobile column, bounded work, existing actions, match routes and result contracts. Research is performed inline because PRODUCT.md records the user's explicit decision to end subagent work.

## Observed problem

The [first Q15 captures](q15/queue-1440-900-dark.png) show repeated section/category headings, a tall page filter panel, small team names and large boxed metadata. The first pair of card actions fits at 1440×900, but the second pair falls below the viewport. Schedule/venue/check-in values compete with the primary job. Thirty similar primary buttons also need match context for assistive technology.

## Primary-source findings

- [USWDS collection guidance](https://designsystem.digital.gov/components/collection/) uses compact related items with a clear identifying heading and secondary metadata. It recommends clear, unique item headings and consistent alignment. **Application to LTMS:** make the two teams the visual identifier; retain tournament/round as secondary context. USWDS's article/archive guidance and suggested six-item limit are not adopted for an operational thirty-task queue.
- [Carbon data table guidance](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) separates global toolbar operations from item actions and stresses space/alignment for dense data. **Application:** keep page search/status together in a compact toolbar; put each match's action in its own footer. This is an adaptation to match cards, not a claim that Carbon prescribes LTMS's layout.
- [Carbon content switcher guidance](https://www.carbondesignsystem.com/building-blocks/core/components/content-switcher/guidelines) supports narrowing related content within the same area, equal-width choices and a single selected view. [Its tabs guidance](https://www.carbondesignsystem.com/building-blocks/core/components/tabs/guidelines) distinguishes filtering the same content from separate navigation. **Application:** short counted category controls, visually quiet unselected states and visible zero counts; maintain local state and existing bucket rules.
- [Atlassian tabs guidance](https://atlassian.design/components/tabs/usage/) recommends showing shared context above view controls, maintaining hierarchy and avoiding nested controls. **Application:** one Referee work heading above the category group; a category-specific next-action hint below it, without repeating the category title as another visible heading.
- [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) documents native button activation with Enter/Space, pressed state and description semantics. **Application:** retain native category buttons with aria-pressed; name each task and describe its repeated actions with its teams, tournament and round. Do not add tab semantics without its corresponding arrow-key model.

## Options considered

| Layout | Benefit | Tradeoff |
| --- | --- | --- |
| Compact match sheets in two columns — selected | Teams, context and a direct next action remain easy to recognize; retains the approved Q15 structure | Less dense than a row-only table |
| Full-width task table | Fast comparison of many fixtures | Long names and mobile require horizontal table navigation; weaker match identity |
| Task list with a persistent preview pane | Convenient repeated preview | More selection/focus state, less task width and duplicated match detail surface |

## Design applied within the approved Q15 flow

- Shorten the filter area's frame, keeping visible labels, filter behavior and URL restoration.
- One Referee work heading with a truthful count for the current view. Four equal category controls: Rooms, Scores, Confirmation, Waiting. A short category hint explains the next step, including that scheduled onsite matches open first and results are recorded only after play.
- Match sheets prioritize paired team names, then tournament/round and current status. Time, venue and check-ins use compact neutral metadata, with no teal KPI tiles. No fabricated urgency, due date, progress or check-in number.
- Secondary Match details stays available; the existing primary action sits consistently at the right end of a footer. No inner card scroll. Task name and action descriptions identify the match.
- Existing role-group tables, modal/check-in access, result entry, permissions and category membership remain. No new product dependency or server request.

These are design inferences from published component guidance and the LTMS captures, not user-testing results or a measured completion-time improvement. Validation and actual rendered comparisons are recorded in worker-layout.md.
