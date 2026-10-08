# R01 — Filled badge text contrast

Status: implemented and locally verified, 2026-10-08. User selected the two P1 fixes after the merged review.

Origin: R01 from the 2026-10-08 Quality20 re-review. Light unread badges and W/L form markers measured 3.42:1 on ruby and 3.15:1 on teal at 12px.

Scope: use the existing accent text token for `.form-guide span`, `.sb .item .pill` and `.bell i`; preserve fill colors and outline tokens. No API/data/permission change.

- [x] Reproduce with computed browser contrast before editing.
- [x] Apply foreground correction.
- [x] Verify visible unread and W/L styles in dark/light at 320, 390, 700, 701, 1280 and 1440px. All measured pairs >=4.5:1.
- [x] Inspect representative screenshots and run frontend source gates.

[Before/after evidence and limitations](../../../docs/reviews/2026-10-08-quality20-p1-fixes/README.md). This closes the measured defect, not app-wide WCAG acceptance.
