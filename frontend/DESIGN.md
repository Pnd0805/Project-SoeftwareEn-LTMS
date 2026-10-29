---
name: "LTMS Minimal Street"
description: "An angular sports workspace with calm controls and street poster identity."
colors:
  void: "#14121C"
  void-2: "#1A1726"
  panel: "#1E1B2A"
  panel-2: "#262234"
  panel-3: "#302B41"
  panel-4: "#3D3653"
  line: "#362F49"
  line-hot: "#7C6F94"
  hairline: "#948699"
  bone: "#E5DCC8"
  bone-dim: "#C7BBA0"
  bone-faint: "#AA9C83"
  accent-ink: "#0A0810"
  red: "#EA4658"
  red-text: "#FF6E80"
  red-ghost: "#2A0F16"
  red-lift: "#FF5A70"
  red-lift-2: "#FF7A8C"
  red-press: "#C22E42"
  red-ghost-2: "#3A1620"
  teal: "#3AAE7C"
  teal-ghost: "#0F2A1E"
  amber: "#D9A430"
  amber-ghost: "#2E2410"
  azurite: "#3D6B54"
  crystal: "#2C4A3D"
  ink: "#0A0810"
  qr-bg: "#E5DCC8"
  qr-ink: "#0A0810"
  light-void: "#F8F4EC"
  light-void-2: "#F1E9D8"
  light-panel: "#FFFFFF"
  light-panel-2: "#F8F4EC"
  light-panel-3: "#F0E6D0"
  light-panel-4: "#E4D4B0"
  light-line: "#E6D9BE"
  light-line-hot: "#8F7A4C"
  light-hairline: "#6E5D3E"
  light-bone: "#2A2117"
  light-bone-dim: "#5A4E36"
  light-bone-faint: "#6E5F42"
  light-accent-ink: "#FFFFFF"
  light-red: "#C23B57"
  light-red-text: "#8A1C38"
  light-red-ghost: "#F8E5EA"
  light-red-lift: "#D45571"
  light-red-lift-2: "#DE6B85"
  light-red-press: "#A32E47"
  light-red-ghost-2: "#F2D2DA"
  light-teal: "#12764E"
  light-teal-ghost: "#E1EFE6"
  light-amber: "#806124"
  light-amber-ghost: "#FAF1DC"
  light-azurite: "#6B8F73"
  light-crystal: "#C7B78D"
  light-ink: "#1E170F"
typography:
  display:
    fontFamily: "Barlow Condensed, Impact, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: ".01em"
  title:
    fontFamily: "Barlow Condensed, Impact, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    letterSpacing: ".01em"
  body:
    fontFamily: "Geist Variable, Geist, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "Geist Variable, Geist, Arial, sans-serif"
    fontSize: "13px"
  button:
    fontFamily: "Geist Variable, Geist, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0"
  preview:
    fontFamily: "Rubik Dirt, Geist Variable, Geist, Arial, sans-serif"
    fontSize: "48px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-.02em"
rounded:
  r: "2px"
  r-lg: "2px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "20px"
  s-6: "24px"
  s-8: "32px"
  s-10: "40px"
  s-12: "48px"
components:
  button:
    backgroundColor: "{colors.panel-3}"
    textColor: "{colors.bone}"
    typography: "{typography.button}"
    rounded: "{rounded.r}"
    padding: "8px 16px"
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.r}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.void}"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "{colors.accent-ink}"
  workspace-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.r}"
    padding: "20px"
  modal:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.r}"
    padding: "24px"
    width: "min(560px, 100%)"
  qr:
    backgroundColor: "{colors.qr-bg}"
    textColor: "{colors.qr-ink}"
    padding: "8px"
---

# Design System: LTMS Minimal Street

## Overview

**Creative North Star: “Minimal Street”.**

The approved B workspace uses A's Tournament discovery and plum/cream palette. Condensed lettering and angular edges carry the retro street identity; working controls use a calm, readable sans serif. Tournament previews alone use the approved wall texture and pasted word strips.

**Key Characteristics:**

- 232px desktop sidebar
- Short English actions
- 2px corners
- Bounded queues
- Explicit source/access states

This record describes the implemented frontend at the Ticket 09 acceptance boundary. Source tokens live in `src/styles/prototype.css`; Account and Search/Inbox apply them through their own feature stylesheets. Evidence and limitations are in [desktop acceptance](docs/superpowers/notes/2026-10-05-ltms-minimal-street-acceptance.md).

## Colors

Dark mode rests on plum surfaces with warm bone text; light mode uses warm paper surfaces and dark brown text. Frontmatter names mirror CSS custom properties; `light-*` entries are the existing explicit light-theme overrides, not additional runtime tokens.

- **Primary — teal:** supported primary actions, active navigation and focus. Use `accent-ink` on filled controls.
- **Secondary — ruby:** destructive actions, live status and the approved preview emphasis. Use `red-text` for readable error text; `red` is principally a fill.
- **Tertiary — amber:** caution and member Team frames; pair caution with words.
- **Neutral — void/panel/bone:** page ground, raised surfaces and text. `bone-dim` and `bone-faint` provide hierarchy. `line-hot` outlines usable controls; quieter dividers use `line`.
- `azurite` and `crystal` are graphics colors, never small text. QR uses the fixed `qr-bg`/`qr-ink` pair in both themes.
- Preview wall/poster colors are intentionally fixed across themes: the image is an identity surface, while facts and actions remain readable.

**The Source Truth Rule.** Loading, denied and unavailable data never become a fabricated empty or successful state. Color reinforces a named state; it does not establish permission.

## Typography

Self-hosted Barlow Condensed Bold carries principal headings (common 40–48px; Tournament title `clamp(36px,4.5vw,60px)`). Geist Variable carries body copy, labels, filters, tabs and forms. Body defaults to 14px/1.6; supporting descriptions commonly use 15px/1.6. Section headings use 24px; ordinary controls use 14px/600. Tabular numbers use tabular figures, with the existing mono stack reserved for score/data presentation.

**The Preview Exception Rule.** self-hosted Rubik Dirt appears only in Tournament preview word strips: 48px/1.3, 32px for long titles; narrow variants use 36px/24px. Tracking stays at -.02em. Facts retain the UI face. Long names wrap rather than enlarge the page.

Native Thai/server strings may remain where existing schema or delivered copy owns them. Both decorative Latin fonts have normal fallback stacks; neither should be forced onto working form labels.

## Layout

The shell is `232px minmax(0,1fr)` on desktop; Guest discovery omits the sidebar. Major workspace groups use 24px gaps, new work panels 20px padding, with tighter groups drawn from the 4px spacing scale. Legacy components can retain their documented 12/16/24px local spacing.

Home places Needs you and Next match in equal columns with 320px bodies that scroll internally. Team management shows one of three equal frames through the existing top tabs. Tournament keeps its established discovery and bracket organization. Organizer, Referee and Admin queues use bounded, labelled regions so a long queue does not dominate the page.

At 820px the shell/sidebar becomes a wrapped top navigation and Home stacks. Journey-specific 900/700/600px rules preserve tables, registration dialogs and working controls. This phase verified 1280×800 and 1440×900 in both themes, plus 390×844 usability. Horizontal scrolling belongs inside a named table/bracket region, never on the page. A full mobile redesign is a separate phase.

## Elevation & Depth

Panels are primarily flat, separated by tone and fine outlines. The approved street identity retains small offset sticker shadows on primary controls and identity details. Dialogs use the soft `lift` shadow: `0 14px 30px -16px`, black at .9 in dark mode and brown at .34 in light mode. `hard` and `hard-sm` remain 4px/2px offset ink shadows for existing identity accents; avoid spreading them through dense working rows.

Button feedback uses 150ms background/color transitions. The existing champion stamp uses a 400ms ease-out authored moment. Reduced motion removes transitions and animations immediately while retaining status feedback.

## Shapes

Panels, buttons, dialogs and filters use the implemented `r`/`r-lg` 2px corners. Team leader and member frames retain their approved color distinction. Fine dividers organize content; strong ink outlines and slight strip rotations belong to existing identity accents. Use the authored SVG icon library and preserve its consistent stroke.

## Components

- **Buttons and forms:** primary teal, secondary raised-surface, destructive ruby. Ordinary buttons are at least 40px high; Account fields/actions use 44px. Preserve hover, disabled, pending, invalid and retry states. Focus uses the shared 3px teal outline with 2px offset.
- **Navigation and tabs:** show the active route parent, preserve permitted destinations and keyboard access. Team management tabs reveal one supported block at a time.
- **Panels and queues:** name the job and its source state. Give overflowing working lists a labelled, focusable region. Keep final action receipts visible after a row disappears.
- **Dialogs:** use the shared Base UI `Modal`; protect focus, offer cancel/close, handle Escape and restore focus. Registration/Organizer review bodies scroll while their action footer stays reachable. Do not replace dialog mechanics with a styled div.
- **Tournament preview:** the approved wall poster is a distinct discovery popup, with a readable facts region and explicit Open tournament link. Keep filters/query selection and return focus intact.
- **QR:** fixed warm light background and dark modules, independent of theme. Rendering tests are not physical camera/scanner acceptance.

The Impeccable sidecar includes nine static visual snippets. These describe appearance; runtime permission, focus and mutation behavior remain in existing React components.

## Do's and Don'ts

- Do reuse the CSS tokens, existing kit contracts and feature stylesheets.
- Do keep labels short and put the problem and recovery in error text.
- Do retain drafts through recoverable source/mutation failures and hide content on actual denial.
- Do keep unavailable capabilities explicit and preserve API/DTO/payload/access contracts.
- Don't add decorative metrics or actions unsupported by delivered data.
- Don't apply wall texture, Rubik Dirt or sticker rotations to ordinary forms and queues.
- Don't equate fixture/browser evidence with live backend or device acceptance.
