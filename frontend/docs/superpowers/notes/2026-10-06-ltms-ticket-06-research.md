# Ticket 06: additional UX candidates

Date: 2026-10-06
Status: recommendations for discussion; not approved acceptance criteria or implementation.
Research performed directly, respecting the user's instruction to stop orchestration.

## Context

Improve Match lists, match details, result work, Lineup and Check-in for desktop first. Preserve Minimal Street identity, concise English UI labels, existing permissions, API contracts, hooks and domain rules. These ten candidates complement the previously proposed next action, compact scoreboard, equal panels with section navigation, result review popup, Check-in summary and readable result history.

## Sources and findings

- [Challonge: Reporting Match Scores](https://kb.challonge.com/en/article/reporting-match-scores-17vxuyb/) offers score reporting from the bracket and a dedicated view grouping matches by round.
- [Toornament: Participant Match Reporting](https://help.toornament.com/match/participant-match-reporting) lets participants dispute reports and describes organizers reviewing both reports before deciding. Its authorization and settlement rules are examples, not LTMS requirements.
- [Score7: Match Times, Dates and Locations](https://kb.score7.io/docs/scheduling/edit-match-details/) states match times use the tournament time zone.
- [W3C WAI: User Notification](https://www.w3.org/WAI/tutorials/forms/notifications/) recommends concise submission feedback, actionable errors, associations between errors and fields, and focus on an erroneous input after submission.
- [GOV.UK: Error Summary](https://design-system.service.gov.uk/components/error-summary/) links validation errors to inputs and moves focus to the summary.
- [GOV.UK: Button](https://design-system.service.gov.uk/components/button/) explains that disabled buttons can confuse users and that slow submissions need immediate feedback; double click prevention is a client interaction measure, not a server guarantee.
- [GOV.UK: File Upload](https://design-system.service.gov.uk/components/file-upload/) provides specific messages for missing files, unsupported types and size limits.

## Ten proposed adaptations

These are design recommendations inferred from the sources and the existing LTMS screens; the sources do not prescribe this exact feature list.

1. Group loaded match lists by tournament and round when supplied, preserving current server-role work queues. Challonge provides the round-grouping example.
2. Put exact start times and available deadlines beside the relevant action, with an explicit display time zone. Never infer a deadline when its source timestamp is absent or let a client countdown override backend authority. Score7 supplies the time-zone precedent.
3. Add clear navigation context: Tournament / Match, return to the list or bracket, and next-match navigation where the current data and routes support it. This is an LTMS navigation recommendation inspired by bracket-to-match reporting.
4. Keep statistics readable through bounded scrolling, sticky table headings and readable player names. This is a local layout recommendation; retain original values and sport-defined columns.
5. Link an actionable validation summary to incorrect fields and move keyboard focus appropriately. Apply W3C/GOV.UK guidance without changing resultRules or introducing new sport rules.
6. Compare the recorded result and disputed claimed score side by side with reasons, only for viewers already authorized to read them. Toornament's two-report review inspires the layout; LTMS settlement rules remain authoritative.
7. Make evidence selection easier to review through image previews, file names/counts and visible upload states. Keep the existing PNG/JPEG and five-file constraints and upload payloads. Preview is our proposed enhancement; GOV.UK supports clear file validation feedback.
8. Explain existing action blockers close to controls: what prerequisite is missing and who can act, where known. Do not create denied actions or invent blocker reasons. GOV.UK's disabled-control guidance motivates clearer explanation.
9. Show separate outcome feedback for saving scores and saving player statistics, including partial success and retained numbers. Use existing mutation states and existing retry behavior. W3C supports clear outcome feedback; the partial-save case is established by ResultForm.tsx.
10. Preserve list filters and position during in-session navigation back from a match. This is our local usability recommendation; no server preference storage or cross-account persistence is proposed.

## Repository evidence and limits

- `src/features/matches/MatchesPage.tsx` already separates work by server roles. Grouping must preserve that distinction; no guessed venue coordinates or new maps capability.
- `src/features/match/ResultForm.tsx` saves the result and player statistics in separate requests and already exposes partial failure. Improve presentation without pretending these writes are atomic or changing retry payloads.
- `src/features/match/ResultTrail.tsx` already has nextMatchId and recorded-result attribution. Navigation and history must reflect only existing data.
- `src/features/match/MatchWorkflowPanel.tsx` already has score claims, reasons, evidence and staged complaint handling. Ordinary Dispute and later Complaint must retain their distinct permissions and timing.
- Missing backend capabilities remain unavailable. No new endpoint, automatic decision, chat, push notification, venue mapping or live score writing is proposed.
- No application code, ticket acceptance criteria, spec or implementation plan was changed during this research.
