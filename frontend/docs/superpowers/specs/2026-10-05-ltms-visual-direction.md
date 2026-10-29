# LTMS — Competition Workspace

Date: 2026-10-05
Status: B prototype and later refinements approved by the user; production rollout and rendered acceptance are pending.
Mode: Operate
Scope: Desktop frontend, shared visual system and existing role journeys.

## Authority and outcome

The user authorized a replacement identity, then selected the B layout with the original A color palette during prototype review. These later choices narrow the earlier design delegation. Keep the LTMS name and concise English interface wording. Work directly, without orchestration or subagents.

LTMS brings public competition discovery and role-specific tournament work into one application. A person may have different responsibilities in different tournaments. Every screen should answer: where am I, what needs my attention, what can I do, and what happened after I acted?

“World-class” is the quality target, not a claim of existing adoption or usability validation. The target is legible information, predictable interactions, recoverable failures and a coherent visual identity across routine and difficult states.

## Selected direction

**Competition Workspace**, derived from **Campus Wayfinding**: a stable navigation system with clear destinations, local context and a single visually dominant next action when the task warrants one.

The user selected prototype **B** on 2026-10-05 with these adjustments: retain the existing A-style Tournaments section, keep a sidebar, use a popup, and use **A's color tone throughout B**. The current Tournaments structure means category tabs, sport and stage filters, and tournament cards with status, relationship and entry context. The preview uses B's layout with A's palette, including the sidebar, controls, cards and popup. A quick-view dialog on a tournament card demonstrates the requested popup; production behavior must use real tournament data, preserve permission checks and provide an explicit path to the full tournament page.

The next refinement pins a **minimal retro street** character: angular corners, athletic poster lettering and crisp outlines, with enough whitespace for clear task scanning. This material choice refines the selected layout rather than reopening the direction choice.

Campus participants recognize schedules, team identities and venue signs. Translate their clarity into the interface: persistent navigation, readable destination titles, aligned fixture information, contextual status and explicit outcomes. Avoid literal signboard decoration.

### Visual language

- Inherit A's palette from `src/styles/prototype.css`: dark aubergine surfaces, warm cream text and emerald actions in dark mode; warm cream surfaces, brown text and deep green actions in light mode. Preserve amber and red for their semantic roles. The prototype follows the current app's saved theme and system preference without writing that preference.
- Bold condensed display lettering for page and section titles, tournament names and sport bands; sentence case with Geist for actions and body text. Use uppercase selectively. The prototype self-hosts Barlow Condensed Bold with its OFL license. Tabular numerals support count comparison.
- Nearly square 2px corners on navigation, cards, controls and the popup. Crisp outlines define surfaces; reserve a small offset shadow for the primary action and normal elevation for the dialog. Flat backgrounds and open spacing keep the street expression restrained.
- Sports character comes from team names, score arrangements, tournament bands and fixture rhythm. Retain B's layout and task hierarchy while carrying A's chosen colors.
- Light and dark themes share hierarchy, interaction states and semantic meaning. Both require contrast and rendered verification.

Color values inherit A's existing tokens. Typography and component geometry will be recorded from the implemented system. The standalone prototype is not evidence of rendered acceptance for the production interface.

## First viewport and visitor path

For a signed-in user, the first viewport has a stable left navigation, a compact global toolbar and a clear Home heading. **Needs you** is the focal section: each task names its tournament/team/match, present state and available next action. Use existing task feeds and capability checks. Never manufacture a task or urgency count.

Tournaments follow as the discovery section, with readable search, filters and result counts when available. Guest Home leads with public tournament discovery. A sidebar destination must identify its actual route; implementation should reconcile the current Home/Tournaments naming without inventing a separate route.

The signature behavior is continuity: following a task preserves context at its destination; finishing an action shows its outcome; a recoverable error retains the user's work and offers the relevant retry. Any return-link behavior must use existing routing and permissions.

## Reach across existing surfaces

| Surface | Primary design change | Completion signal |
| --- | --- | --- |
| Shell and Home | Stable location, task priority and readable navigation | The user can locate their next permitted task |
| Tournaments | Consistent search/filter hierarchy and clear entry status | The selected tournament and available action are obvious |
| Tournament detail | Identity and status first, then contextual tabs and work | Registration, schedule and result states remain distinct |
| Teams | Separate membership, invitations and team management | An invitation or membership action leaves a visible outcome |
| Matches | Aligned participants, score/time context and supported actions | An assignment or match state is understandable without guessed capabilities |
| Organizer, Referee and Admin | Shared layout rules with responsibility-specific queues | The relevant item, scope and decision are visible together |
| Forms and dialogs | Clear labels, grouped fields and consistent action placement | Validation is specific and input survives retryable failures |
| Search, Inbox and Profile | Consistent headings, readable rows and meaningful empty states | The user understands both results and the next available step |

## States and boundaries

- Preserve the distinction between loading, empty, partial data, unknown, denied and failed states. A failed fetch must not become “No results.”
- Use concise labels such as “Home,” “Teams,” “Matches,” “Invite,” “Register,” “Save” and “Retry.” Include enough contextual text for ambiguous actions and accessible names.
- Preserve existing modal keyboard behavior, focus restoration, contextual controls and form selections during recoverable refresh failure.
- Support long tournament/team names, multiple responsibilities, empty and large lists, and mixed source availability. Do not use truncation to hide the only identifying context.
- Keep API adapters, DTOs, endpoints, payloads, hook implementations, server permissions, backend files and shared business rules frozen for this visual work.
- Existing Match capability gaps remain explicit. Visual design cannot enable unsupported operations.
- Desktop comes first. Mobile implementation follows desktop acceptance; shared components must retain responsive behavior in the meantime.

## Impeccable direction record

Seven grounded candidates were ordered before the concept seed:

1. **Event Control** — tournament operations desk; an immediate work queue with nearby schedule context.
2. **Matchday Ledger** — fixture sheet and scoreboard; compact team/time alignment for repeat use.
3. **Campus Wayfinding** — stable destinations, clear location and contextual next actions.
4. **Officials Record** — structured match records; evidence beside decisions and well-grouped forms.
5. **Live Rundown** — broadcast production rundown; time-ordered rows and current-state visibility.
6. **Competition Journal** — federation publication; clear tournament identity and legible summaries.
7. **Dispatch Board** — ground operations board; explicit responsibility, status and dense work queues.

The alternatives span operational screens, paper records/publications and spatial navigation. A generic metric-card dashboard and a purely decorative sports landing page were excluded because neither establishes the task mechanism.

`concept-seed --scope direction --mode operate` returned seed **000dfbbd**, assigned index **3**. The assigned selection was acknowledged once. The user delegated the choice; no separate approval is being inferred from elapsed time.

Challengers were evaluated after translating their form to LTMS facts. The two axes are audience identification and product clarity. The following are design judgments, not findings from user testing.

| Challenger | Audience identification | Product clarity | Verdict and retained discipline |
| --- | --- | --- | --- |
| Ikeda Datamatics | Abstract data art has weaker ties to everyday tournament work | Barcode-like density weakens task and action reading | Declined. Raise contrast discipline and make every accent carry meaning |
| Japanese High-Density Web | Familiar to some expert users but less broadly approachable | Dense simultaneous modules obscure first-use priorities | Declined. Provide compact comparison rows where repeated scanning benefits |
| Manual Acetate Tab Board | Manual tabs are recognizable but indirect to competition tasks | Literal layering competes with current context | Declined. Make navigation levels and active location unmistakable |
| Labanotation | Dance notation is outside most users' working vocabulary | Its upward symbolic timeline needs learning | Declined. Align related participants, states and timings consistently |
| Boarding Pass and Gate Board | Schedules and venues are recognizable, but travel is an indirect identity | Stable row identity and time/status ranking are strong | Competitive. A full alternate for schedule-heavy screens; lower fit for team and administrative work keeps Campus Wayfinding selected |
| Crouwel Grid Specimen | Constructed display typography is less connected to daily competition work | Monumental type takes space from actionable information | Declined. Use a consistent alignment grid across navigation, forms and tables |

The Boarding Pass and Gate Board quality-bar references were inspected. They are inspiration only, stored under `.impeccable/references/`; no reference brand, barcode motif or image is a shipping LTMS asset. Event Control remains the grounded alternative: effective for experienced operators, with a risk of making casual participants feel they entered an administrative tool.

The principal risk of Competition Workspace is becoming visually generic. Counter it through precise competition information, task continuity, strong fixture and score layouts, and consistent craft. Do not counter it with decorative noise.

## Implementation sequence and acceptance

1. Implement the approved B prototype's shared shell, tokens and key components; the later color and retro street refinements are part of that approval.
2. Apply the system to Home and tournament discovery with real source-state behavior.
3. Extend it through teams, registration, tournament detail and the role-specific work queues.
4. Check copy, keyboard behavior, focus, contrast and recovery states; preserve the existing regression coverage.
5. Verify the rendered desktop surfaces at 1280 × 800 and 1440 × 900 in both themes, then record the implemented system in DESIGN.md and its Impeccable sidecar.

For implementation after the prototype approval, read the [rollout spec](2026-10-05-ltms-minimal-street.md) for behavior and scope, then its linked tickets and implementation plan. This direction record is visual context, not an implementation report or evidence that production has passed visual review. Browser access and a live backend were unavailable during the preceding validation; those acceptance conditions remain open.
