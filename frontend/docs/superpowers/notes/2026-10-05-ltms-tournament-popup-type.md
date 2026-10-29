# Tournament popup — Lettering

The user requested a more prominent font with playful treatment for the existing street wall popup. Scope is the Tournament preview headline.

## Delivered

- Replace the preview headline's Barlow with [Rubik Dirt](https://fonts.google.com/specimen/Rubik%2BDirt): chunky letterforms with worn print texture. Other headings remain Barlow; facts and controls remain Geist.
- Separate word strips, slightly different angles and a ruby final-word accent. Existing name text and accessible dialog name are retained.
- Fixed display roles: 48px desktop / 36px mobile; compact long-name variants at 32px / 24px. Long words wrap; the existing scrollable facts and visible footer remain.
- Self-hosted Latin WOFF2, about 303 KiB, `font-display: swap`, system/body fallback for unsupported characters. The SIL Open Font License is included as `public/fonts/OFL-rubik-dirt.txt`. No external font request in the shipped UI, no runtime package added.

Source: [Google Fonts stylesheet](https://fonts.googleapis.com/css2?family=Rubik+Dirt&display=swap), Latin font URL and license copied from the official Google Fonts sources.

## Evidence

- Typography assessment: the prior 48px Barlow headline shared the card voice; this request explicitly permits replacing the popup face. The new font and word composition establish the display role while the factual data keeps its existing role and measure.
- Impeccable typography detector before and after: `[]`, exit 0. Direct source review found no remaining blocking findings.
- Preview and Modal tests: 2 files / 29 cases passed. During implementation, nested word wrappers changed the accessible name; using DOM-free fragments restored the existing named-dialog tests without weakening their expectations.
- TypeScript, ESLint, production build and whitespace checks passed. Existing bundle-size warning remains.
- Batched browser inspection: 1280×800 and 1440×900 in both themes, mobile 390×844, long names and venues, Escape/Back/focus return and organizer destination. The actual Rubik Dirt face loaded; no horizontal overflow or page errors. Body stays on Geist. Cream/ink contrast 13.59:1 and ruby/ink 4.87:1.
- All 49 frozen API/DTO/hooks/store/rules hashes match the phase baseline. No backend contract or business behavior edits. Other inherited work remains outside this commit.

[Desktop](tournament-popup-type/desktop-1280-dark.png) · [Light](tournament-popup-type/desktop-1440-light.png) · [Mobile](tournament-popup-type/mobile-390-dark.png) · [Long content](tournament-popup-type/long-mobile-light.png) · [Measurements](tournament-popup-type/browser-checks.json)

This is direct implementer review and local mock rendering. No subagents or live backend validation.
