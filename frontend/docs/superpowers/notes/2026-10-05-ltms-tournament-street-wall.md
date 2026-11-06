# Tournament preview — Street art wall

Approved follow-up to Ticket 02: the user requested a stronger street art wall feel for the popup. Scope is Tournament preview presentation.

## Changes

- A tactile spray-painted concrete wall with wheatpaste remnants behind the heading, using the existing charcoal, emerald, cream and ruby color family.
- Barlow Condensed headline at 48px desktop / 36px mobile, on slightly angled cream poster strips. Real sport name appears on a small angled sticker.
- Quiet fact rows below the artwork; long content scrolls in a named, keyboard-focusable facts region while the heading and actions stay visible.
- Optional presentation `className` on shared Modal scopes the treatment to Tournament preview. Other popup layouts retain their default class.
- Existing preview selection, destinations, Close/Escape/Back, unknown-field handling and permissions remain intact. No API, DTO, hook, store or business-rule edits.

## Verification

- Preview and shared Modal tests: 2 files / 29 cases pass.
- TypeScript, ESLint, production build and whitespace checks pass. Existing bundle-size warning remains.
- Impeccable detector once on changed UI markup: exit 0, no findings printed.
- Batched browser inspection: desktop 1280×800 / 1440×900 in dark and light, mobile 390×844, long titles and unbroken venue names, keyboard Escape/Back/focus return and organizer destination. No page errors or horizontal overflow. One correction moved scrolling into the facts area after the first long mobile capture revealed initial heading clipping; confirmed in the final batch.
- Title uses solid cream/charcoal, rather than relying on image contrast. Facts retain the verified theme token pairs (dark primary 12.37:1, secondary 8.87:1; light primary 15.81:1, secondary 8.15:1).
- Direct implementer standards/spec review: no remaining blocking findings. No subagents used.
- Backend unavailable; rendered evidence uses isolated demo contexts. API semantics are covered by the existing real-source preview fixtures.

[Desktop](tournament-street-wall/desktop-1280-dark.png) · [Light](tournament-street-wall/desktop-1440-light.png) · [Mobile](tournament-street-wall/mobile-390-dark.png) · [Long content](tournament-street-wall/long-mobile-light.png) · [Browser measurements](tournament-street-wall/browser-checks.json)

## Generated asset

Mode: built-in Imagegen. Final saved asset: `frontend/public/images/tournament-street-wall.webp` (1280×853, approximately 219 KiB). Generated source is preserved under the tool's original saved path; the project consumes its optimized WebP copy. Artwork is decorative and contains no factual copy, logos or claims.

Final prompt:

> Use case: photorealistic-natural. Asset type: decorative street-art wall background for the header of a tournament preview popup in the LTMS web app. Create one wide landscape front-on photograph-like texture, 1536x1024. An authentic weathered charcoal concrete wall with layered aerosol paint and remnants of wheatpaste paper, minimal urban sports poster atmosphere. Bold broad worn emerald-green paint strokes and a small faded ruby-red overpaint patch near the far right edge, cream paper fragments at edges, tactile chipped paint and subtle concrete pores. Left two thirds mostly quiet dark charcoal with broad tonal areas suitable for overlaid large readable HTML tournament title. Strong art direction, restrained composition, material realism, no objects or people, no signs, no words, no letters, no numbers, no logos, no watermark, no UI. Palette charcoal violet #1E1B2A, emerald #3AAE7C, muted cream #E5DCC8, restrained ruby #EA4658. Flat even ambient light, no vignette, no glossy effects. This is a background material asset, not a mockup.
