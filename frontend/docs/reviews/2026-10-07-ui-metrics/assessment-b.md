# Assessment B — technical evidence and manual verification

The independent worker collected detector/browser evidence, then hit the account usage limit before writing its conclusions. Root completed this assessment after recording Assessment A. Do not describe this as a fully completed dual-agent assessment.

## Score

| Dimension | /4 | Evidence |
|---|---:|---|
| Accessibility | 2 | Light Schedule header contrast 3.14:1 at 13px bold; empty table headers; Scan failure not announced as an error and status remains Starting camera. Visible skip/focus and Scan Escape restoration work. |
| Performance | 2 | Current build main JS 944,829 bytes (269.45 kB gzip from preceding build); all route imports static in App.tsx. ZXing is separately imported. No field LCP/INP measurement. |
| Responsive | 2 | 20/20 sampled route/theme/viewport checks have no page horizontal overflow; multiple controls remain below 44px; mobile shell and sparse fixed-height panels consume viewport. |
| Theming | 3 | Coherent tokens in both themes; global table-header ink token fails on light teal. |
| Implementation integrity | 3 | Reusable kit, real/mock separation and predictable source states. Remaining typography-scale drift is advisory, not established breakage. |
| Total | 12/20 | Acceptable; fix verified weaknesses before calling the experience polished. |

## Detector accounting

Raw: `b/detector-raw.json`. 175 findings: 167 advisory, 8 warning. Rules: design-system-color 54; design-system-font-size 100; design-system-radius 12; undersized-ui-text 2; and one each low-contrast, extreme-negative-tracking, tiny-text, gpt-thin-border-wide-shadow, overused-font, dark-glow, broken-image.

78 findings belong to `Home.prototype.html`; 11 to test/mock files. Excluding those leaves 86 active-source findings: 84 font-size advisories, 1 radius advisory, 1 broken-image warning. The last is a false positive: `MatchWorkflowPanel.tsx:25` creates an object URL in its effect and assigns the image src, then revokes it. All seven other warnings are in the historical prototype. Thus CLI counts are not 175 product bugs. A Geist warning does not override the approved readable UI typography. Angular corners and restrained street shadows are intentional.

## Browser evidence

Five surfaces (Home, Teams, Schedule, Profile, Login), each at 1440x900 and 390x844 in both themes: 20 axe/DOM checks. All have no page overflow, no broken loaded images, and no page errors in the completed results. This does not prove all routes or 320px/400% reflow conform.

- Schedule light: 6 text header cells fail contrast, same problem reproduced at two widths; 3.14:1 from foreground #1e170f on #12764e, 13px bold. Use `--accent-ink` on colored header fills, or a neutral header background. Source `src/styles/prototype.css:316`.
- Schedule: 2 empty th elements; label action columns for assistive technology and avoid semantic empty headers for decorative separators.
- Signed-in shell: search form and avatar sit outside a landmark. Axe flags region as best practice; do not claim every such finding is an AA violation. Use a semantic header/banner and search landmark.
- Controls below the 44px comfort target per page: Home 7, Teams 13, Schedule 27, Profile 6, Login 0. No sampled control was below 24px. Counts include links/secondary controls and are not counts of WCAG target-size failures.
- First Tab: named Skip to main control, visible 3px teal focus; Login starts at an input with a visible 2px outline.
- Axe contrast analysis has incomplete nodes on several pages (e.g. gradients/complex backgrounds). No whole-app AA certification follows from this pass.

## Overlay and cleanup

Mutable preflight and detector injection succeeded in five isolated headless pages. Console counts: Home 6, Profile 1, others 0. Headless overlay captures exist in `b/*-overlay.png`; no user-visible [Human] tab was opened, and no claim of a visible overlay is made. This follows the user's earlier objection to opening Chrome. The helper live server PID 5641 on port 8400 was verified as Impeccable's process and stopped by root. Existing application servers were retained. No detector rerun was needed.

## References

- [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum): 4.5:1 for ordinary text, 3:1 for qualifying large text.
- [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24x24 CSS px or a qualifying exception; 44x44 is our preferred touch comfort target, not the AA minimum.
- [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): a separate reflow test remains necessary; a 390px screenshot alone is insufficient.
