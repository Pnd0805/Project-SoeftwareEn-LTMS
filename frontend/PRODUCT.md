# LTMS

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Guests discover public tournaments and results. Players follow their teams and matches. Team Leaders manage invitations and tournament entries. Organizers set up and run tournaments. Referees carry out assigned match work. Admins review requests within their permissions. One person can have different responsibilities in different tournaments.

## Product Purpose

Make tournament work understandable: show the relevant context, current state, next permitted action, and the outcome of that action. The user identified difficulty, visual clutter, unattractive presentation and confusing flows across the existing frontend.

## Operating Context

Desktop first; mobile adaptation follows desktop acceptance. Existing flows cover discovery, team membership, registration, tournament setup, appointments, match assignments, check-in, results, disputes and administrative review. Detailed policy must be verified against current contracts; historical glossary text is not authority for changing server rules.

## Capabilities and Constraints

- React/TypeScript frontend with existing mock and real data modes.
- Work under frontend only. Preserve API adapters, DTOs, endpoints, mutation payloads and server permissions. Backend integration is owned by another team.
- Existing source-state and accessibility corrections must survive the redesign, including retained form selections during retryable refresh failure.
- Real Match action capabilities remain incomplete in the currently consumed data. Do not invent actions or progress from missing data.
- No commits or pushes unless requested.

## Brand Commitments

- Keep the product name LTMS and concise English interface wording.
- On 2026-10-05, the user explicitly authorized the assistant to replace the visual identity and choose a professional international product direction. This supersedes the earlier requirement to preserve the dark/green Street identity.
- During prototype review, the user chose B's layout with A's tournament card structure and color tone, plus the sidebar and popup interactions. This later palette preference supersedes the proposed blue/grey palette; preserve the original dark and light color families.
- The user then requested angular, retro street styling with a minimal and easy-to-read presentation. Preserve clear spacing and readable body text while expressing that character through compact bold headings, square corners and restrained outlines.
- The assistant works directly; the user ended orchestration and subagent work.

## Evidence on Hand

Current components, route structure, mock seed data, API contracts and the UX specifications under docs/superpowers. Existing fixtures are demonstration data, not evidence of customers, adoption or performance. No commercial claims are authorized.

## Product Principles

- Prioritize the next relevant task and its tournament, team or match context.
- Distinguish unknown, loading, empty, denied and failed states.
- Keep a user's work recoverable when a request fails.
- Make shared interactions consistent across responsibilities.
- Use the server's current permissions and decisions as authority.

## Accessibility & Inclusion

Keyboard access, named controls and dialogs, visible focus, readable contrast, understandable status feedback and long-content handling are acceptance requirements. Validate 1280 x 800 and 1440 x 900 desktop layouts before declaring rendered acceptance.

## Open Acceptance Conditions

Browser access was previously denied and the local backend was unavailable. Automated checks do not establish rendered visual quality or live-backend acceptance.
