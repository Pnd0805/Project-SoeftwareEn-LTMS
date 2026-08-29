# LTMS Front-End Design Spec

Resolved via grilling session on top of `requirement.txt`, then extended after a design review.
Then reconciled against the five user story maps and the SRS flowcharts, which overruled several earlier calls.
See `CONTEXT.md` for term definitions. Built out in `ltms-mockup.html` (77 screens).

## Visual style
- **v1 is street graffiti over the NEW_UI aurora palette** (`NEW_UI/color pattle.jpg`):
  Black Velvet `#212231` cards on a `#181926` ground, Supernatural `#313642` raised, Silver Tree
  `#66C291` as the accent that glows, Mauve Melody / Vaporous Grey as ink. Azurite `#488270` and
  Crystal Ball `#375A55` fill bands and stripes and never carry text (both under AA).
- **Sticker construction**: every surface is cut with a 2px `--ink` (#0C0D14) outline and a hard,
  blur-free offset shadow (`--hard` 4px, `--hard-sm` 2px). Buttons translate into their own shadow
  on press; cards lift out of it on hover. Badges and the brand mark sit a degree or two crooked.
  Radius is 2–3px — a cut-out has corners, not curves.
- **Type: system faces only** — the prototype is one file that must open offline, so no webfont link.
  Display is `Bahnschrift` (condensed variable, ships with Windows) at weight 700 / stretch 87.5%,
  uppercase, falling back through Archivo Narrow → Roboto Condensed → Impact. Body is
  `Segoe UI Variable Text` → system-ui. Mono (`Cascadia Mono` → Consolas) carries labels and figures.
- **Reading floor**: body 16px/1.6, secondary 15px, mono labels 13px, counters 12px. Nothing that
  carries meaning sits below 10.5px, and all-caps tracking is capped at .1em.
- **The small-text band is a four-step scale** — 12 · 13 · 15 · 16. It was fourteen distinct sizes
  between 9px and 15px, which is how a system drifts: each one was reasonable on its own.
- **Skins, not forks**: `ltms-prototype-v2.html` (Street/plum) and `-v3.html` (Editorial/light) share
  v1's script byte-for-byte and differ only in `<style>`. `node sync-skins.js` carries v1 logic across.
- **Enforced, not asserted.** `test-prototype.js` measures the stylesheet: no size below the floor,
  no more than six steps in the small band, `--hairline` never sets text, every body colour clears
  4.5:1 on all five surfaces, padding and gap on the 4px grid, and no raw hex loose in a rule.
- shadcn/ui + Tailwind CSS (unchanged from requirement.txt).

### Accessibility floor
Every text colour clears **4.5:1 on the darkest surface it can sit on** (`--panel-3`). Verified, not assumed —
`--bone-faint` originally shipped at 3.06:1 and was raised. Colours below AA are not permitted to carry text,
including decorative separators. `--red` (#FF5C72) is a fill only — it carries `--ink` on top of it, never the reverse; `--red-text` (#FF8494) is the hue lifted until it clears AA on all five surfaces, and it is the one that carries words.

## Nav shell
- **Guest** (no login): public topnav — logo, nav links, no sidebar.
- **All logged-in roles**: fixed left sidebar + topbar (search, notification bell, avatar). One shell, menu filtered by role.
- **Deep pages carry a breadcrumb bar** with an explicit Back control. Any page more than one level from a
  section root gets one.

## Page layout — work left, facts right
- **The heavy pages split in half** (`.split`, the same grid `.profile` already used): the thing you came
  to do on the left, a sticky rail of facts on the right. Below 900px the rail drops under the content.
- **Home stays one column** — it is a grid of cards, and a rail would only squeeze them. The *Needs you*
  queue sits at the top, full width, laying its rows out in columns so ten items do not push the grid
  off the screen. Under it the filter is a **sticky toolbar** (search + one chip per sport + Clear) that
  follows the page down, labelled with the live count (`Find one · 8 of 23`).
- **Tournament**: tabs and their content left; a `.facts` card (sport, format, date, venue, channel,
  entry rules, squads in / cap, organizer) plus the organizer's entry notes in the rail. That card replaced
  the single dense meta line that used to run the date, venue and entry rules together.
- **Match**: scorebug and the action you can take (enter / confirm / resolve) left — the action moved up
  from the bottom of the page; kick-off, venue, channel, referees, stage and the result trail in the rail.
- Wide tables (schedule, leaderboard) still scroll inside `.tblwrap` when the rail narrows their column.

## Three formats, one Draw — feedback pass 1
`requirement.txt` §3 narrowed the first build to single elimination. **Review overruled it**: a Tournament now
picks **Single Elimination, Double Elimination or Round Robin** when it is requested, and the choice is fixed once
the Draw is made.
- **Single elimination** — unchanged. Slot `i` pairs with `size-1-i` so byes spread; see "Bracket at scale".
- **Double elimination** — a Losers bracket holds every Team on its first loss; a Team is out on its second. The
  two brackets meet once, in a **single Grand final**. **No bracket reset** — the Team arriving from the Losers
  bracket does not have to win twice. That keeps `scheduled → pending → confirmed | disputed` intact: no Match
  exists whose existence depends on the result of another.
- **Round robin** — no Bracket. Every Team plays every other once and a **Standings** table replaces the tree.
  **3 / 1 / 0.** Teams level on points separate by score difference, then Score units scored, then the result
  between them; still level, they **share the rank** — the table says so rather than inventing a fourth rule.
- **Champion** is the winner of the last Match in an elimination format, and the top of the Standings once every
  Round Robin Match is Confirmed. A Round Robin that finishes with two Teams inseparable is decided by the
  Organizer, on the record. MVP voting opens on that moment in every format, not on "the final".
- **Draws can be arranged by hand.** The Organizer may rearrange slots until the **first Match starts** — check-in,
  a recorded score or a published kick-off all count as started. After that the Draw is locked; a result already
  played cannot be re-parented.

## The organizer is walked through the order
The job is a sequence and the manage tab states it, drawn with the same trail a match result uses:
**appoint the referees → open it to the public → approve the squads → draw the bracket → set every
fixture → results come in.** Each step carries its own count (2 of 2 accepted, 8 approved · 0 waiting,
6 of 7 fixtures set), exactly one step is lit, and only the lit step carries a button — which is where
*Appoint a referee*, *Open to public* and the draw now live. A step whose action `PERM` would refuse (publishing a tournament
an admin has not answered yet) says so instead of offering a button that would bounce. Every step is
derived on render; none of it is stored.

## Match assignment — who, where, when
After the Draw, the Organizer sets a **kick-off time, a Venue and named Referees on each Match**. This supersedes
"referees are fixed once the bracket is drawn" — that rule froze the appointment *list*; the per-Match assignment
stays editable until that Match starts.
- **Appointing is a modal, the standing is not.** The manage panel shows who is on the Tournament, how many
  of `refsNeeded(t)` have accepted, and the warning if it is short — that is what the Organizer needs at a
  glance. Searching the whole roll is a job with one answer, so *Appoint a referee* opens it over the page
  (`refereeFinder`), and an invitation sent from there redraws the modal rather than closing it, because the
  on-site channel needs two. Same split as the hard filter: the page states, the modal changes.
- **Only an assigned Referee may record that Match.** Appointment to the Tournament makes someone eligible;
  assignment makes them responsible, and the referee console shows their own Matches rather than the whole draw.
  Onsite needs two assigned, online one — the same counts `publish` already enforces per Tournament.
- **Venue is a map pin.** Name plus latitude and longitude, set by pasting a Google Maps link or dropping a pin.
  Stored as coordinates, rendered as a **link out** to Google Maps — never an embedded map, because the prototype
  must keep opening from a file with no network. The Tournament carries a default Venue; any Match may override it.
  An online Match has none.
- **A fixture is set on its own page, at `#/m/<id>/fixture`** — one card with labelled fields (kick-off,
  venue, map pin, Referee 1/2) that stack instead of shrinking. It replaced a seven-column table on the
  manage tab whose last two columns were the referee pickers: once the tournament page grew a rail they
  squeezed to nothing and the officials effectively disappeared. **The manage tab no longer carries any
  fixture form** — one editor, one place. Manage still appoints Referees to the Tournament; putting one on
  a Match happens here.
- **Two ways in, both from the Match**: a button in its own detail rail, and a *Fixture* link on each open row
  of the Schedule tab. A Match that has started shows the same four fields as a read-only fact list.
- Anybody who is not the organizer gets a 403 page and no form, and `PERM.assign` refuses the action whichever
  page drew the fields — the page guard only stops it being drawn.

## Match visibility
- Guest sees Match results at every status (Pending / Disputed / Confirmed), distinguished by badge — no hiding.

## Match data
- The system stores **what a Referee enters and nothing more**: the score, per-player statistics, and the
  confirmation trail. No attendance, possession or any figure nobody records. See "Match statistics exist" below.

## Eligibility is a HARD FILTER — decided
`requirement.txt` §6 and the OF-02 flowchart disagreed. **The flowchart wins.**
- The system **rejects a registration outright** if any player fails gender / age / faculty / **major** / year,
  and names who failed. There is no organizer override — the squad must change and register again.
- **Major was added after the first build.** A faculty cup and a departmental one are different competitions;
  Engineering is not one population. `rules.major` defaults to `"any"`, and `migrate()` fills it in for state
  saved before the field existed.
- **Year of study is on the form** (feedback pass 1), and **every condition is optional** — age included. An unset
  condition admits everyone; it is not a condition that always fails. The conditions are picked from **dropdowns**,
  not typed, so "Engineering" and "engineering" cannot both exist.
- **The filter reads the Squad list, not the whole Team.** A member the Leader did not enter cannot fail it,
  because they are not entering.
- The check runs **before submission**, so a Team Leader sees the blockers while they can still act. Submit stays
  disabled until the squad clears.
- What reaches an Organizer is the **soft filter** only: documents and anything the rules can't express as a field.
- **Entry notes** are the other half of that, added in feedback pass 1: free text the Organizer writes while setting
  the Tournament up — alongside appointing referees — published on the Tournament page so a Leader reads it before
  registering. **The system never checks Entry notes**; it shows them, and the Organizer judges against them. Making
  them machine-checked would be a second hard filter wearing a soft filter's name.
- The advisory red-flag model is dead. Do not reintroduce "approve anyway".
- **The filter is locked after creation, and changing it is a request** (feedback pass 2). The Manage tab shows the
  rules in force and a *Request a change* button; the Organizer gives a reason, every Admin is notified, and the
  Admin page carries an approve/decline queue beside the permanent-squad one. An Organizer never edits the rules
  in place — that is the loophole the hard filter exists to close.
- **The request carries the conditions, not just a reason.** *Request a change* opens a modal holding **the same six
  condition fields the Tournament was created with**, prefilled with the rules in force — one `filterFields()`
  renders both forms and one `readRules()` reads both, so the two cannot drift into asking different questions.
  The Organizer sets what they want and says why; both travel with the request. The Admin queue shows
  `in force → asked for`, and **approving is the edit** — it writes the new rules onto the Tournament. There is
  still no in-place editor at either end, which is the point.

## On-site vs online — the roles swap, the steps don't (OF-03)
Both channels have the same two steps; who performs each one swaps.
- **On-site** — **two referees minimum** record the score *and* per-player statistics → the **winning** Team
  Leader checks and confirms. The losing side does not sign off; it disputes.
- **Online** — the **winning Team Leader submits** the result → the **Referee** checks and confirms.

An earlier draft had online skipping leader involvement entirely. That was wrong.

**A result nobody confirms stalls the Tournament**, so feedback pass 1 gives the Organizer a **confirm of last
resort** on a Pending result — recorded as their decision, with their name on it, never silently and never as if
the missing party had acted.

**A Dispute is raised by a Team.** The person who clicked is who clicked; the objecting party is the Team, and every
screen showing a dispute names the Team, not only the player.

## Match statistics exist — two levels, per sport
OF-03 has the Referee recording "ผลและสถิติ", and the referee story map carries "แก้ไขสถิติการแข่งขัน". Statistics are
**referee-entered**, feeding the top-scorer table, player profiles and MVP candidate ranking. They are correctable
after submission; a confirmed score is not.

Feedback pass 1 replaced the two-column-per-sport model with **a Player statistic set and a Team statistic set per
sport**:

| Sport | Player statistics | Team statistics |
|---|---|---|
| Football, Futsal | Goals, Assists, Yellow cards, Red cards | Goals *(derived)*, Yellow cards *(derived)*, Red cards *(derived)* |
| Basketball | Points, Rebounds, Assists | Points per Quarter, Total points, Fouls |
| Volleyball | Points, Blocks | Points per set |
| Badminton | Points won | Points per game, Deuces, Rallies |
| VALORANT | Kills, Deaths, Assists, First kills, Plants, Defuses | Maps won–lost, Rounds won–lost |
| ROV | Kills, Deaths, Assists, Damage dealt, Damage taken | Games won–lost, Total kills |
| Chess | none — the sheet says so | none |

- **A team figure that is the sum of its players is derived, never typed.** Team goals, team cards, team kills come
  from the player rows. A figure enterable two ways is a disagreement waiting to happen.
- **A team figure no sum can produce is entered by the Referee**: points per Quarter, Maps and Rounds, Deuces and
  Rallies. Each sport names every figure as one or the other; there is no third case.
- **`Esports` is gone as a sport.** VALORANT and ROV are separate sports with separate sheets — the existing rule
  that statistics never sum across sports does the rest. Saved state from before the split migrates on load.

## MVP voting is a tournament award
OF-03 opens MVP voting at exactly one moment: **when the Champion is decided** — the last Match of an elimination
bracket confirmed, or the last Round Robin Match confirmed and the Standings settled.
Not per match. Candidates come from the whole competition, ranked on referee-recorded statistics. Pick'em is the
per-match one, and it closes when each match's result is recorded.

## Check-in and identity verification (OF-03 stage 1)
A match cannot open until the referee has resolved the check-in list.
- **On-site** — the Player signs in as themselves *and* scans the Organizer's QR at the venue. The account proves
  identity, the scan proves presence; neither alone is enough. The code rotates every 60s so it can't be forwarded.
- **Online** — the Player photographs a student or national ID for the Referee to verify. Held for that match only,
  never on the public profile, never exportable.
- A player who cannot verify is **marked ineligible for that match and reported to the Organizer** — recorded, not
  just refused. The rest of the squad plays.

## Teams have a lifecycle (OF-01)
- **Forming → Ready.** A Forming team is below the minimum squad size and cannot register for anything.
- Membership is pending until the invited player accepts — adding a Player creates an **Invitation**, never a
  membership, because accepting exposes their eligibility data to an Organizer.
- **Auto-disable**: a team that enters no tournament within two weeks of creation, or goes six months idle after
  its first, is disabled automatically. A **permanent team** — approved by an Admin — is exempt.

## Squad list and Lineup — feedback pass 1
Two lists, not one, because they answer different questions.
- **Squad list** — who from the Team enters *this Tournament*, chosen at registration. The hard filter reads it.
- **Lineup** — who plays *this Match*, split **Starters / Substitutes**, named by the Leader before kick-off.
  Check-in applies to the Lineup, and only a named Player can carry statistics for that Match.
- A Team that names no Lineup fields its previous Starters. **Paperwork never blocks a Match from being played** —
  the referee console must not be able to deadlock on an absent Leader.
- A Team picks its **sport at creation** and the minimum squad size follows from the sport. Forming → Ready is
  judged against that number, not a single global one.
- Teams carry a **logo**, and the invite flow **searches the roll by name** — the same search the Organizer uses to
  appoint a Referee, not a second one. **The logo is the Team's face wherever the Team is the subject** (feedback
  pass 2): it replaces the colour-and-code badge at the head of the Team page, and a squad that has uploaded none
  falls back to that badge rather than to a gap. Uploading it and never showing it was the pass-2 defect.
- **Permanent status is requested, not claimed**: the Leader asks with a reason, an Admin decides, in the same queue
  as a Tournament request.

## Referee appointments are invitations, and officiating is not a role
An Organizer offers; the Referee accepts or declines. A match is only covered once its referees have accepted —
two of them for on-site, one for online.
- **Any student can be asked.** There is no `officiate` permission to grant first: the organizer searches the
  whole roll by name and invites. This supersedes the external-referee approval route on `spec.pdf` p22.
- Declining does not yet carry a reason, though this section asked for one. Open.
- The candidate list is searched, never scrolled: everyone is rendered and filtered in the DOM, capped at eight
  visible matches. Past a few thousand students that filter belongs on the server.

## Announcements
requirement.txt §10 makes announcements a broadcast from the Organizer, so both halves must exist:
- Organizer writes one, with reach stated before sending (public page + every participant). Editable, not unsendable.
- **Guests read them on the public tournament page** — an announcement that only reaches logged-in users fails
  the purpose. Participants additionally get it in their notification inbox.

## Overlay and feedback — five layers, and the two that were skipped
Everything that covers the page or speaks over it comes from one of five things, and each answers a
different question. Anything not on this list is not built, because nothing in LTMS asks for it.

| Layer | What it answers | Where it lives |
|---|---|---|
| **Modal — form** | *Set these values.* | `filterFields` (hard filter change), `refereeFinder` (appoint), `pickBlock`, `commentBlock`, squad review, result entry |
| **Modal — confirmation** | *Did you mean it?* | `ask()` + `confirmCard()` — 7 actions |
| **Modal — warning** | *Did you mean it, and it bites.* | the same card with `kind: "danger"` — red button, "Destructive" tag |
| **Toast** | *It happened.* | `toast()`, bottom-right, `role="status"`, 4.2s |
| **Notification** | *It happened while you were elsewhere.* | `notify()` → bell → `#/inbox` |

- **No native `confirm()` anywhere.** It is another application's dialog wearing none of this one's clothes,
  and it renders both answers identically — a browser cannot be told which button is the one that disbands
  a squad. `ask(el, {title, body, ok, kind})` returns `true` once answered, so a call site is still one line.
- **The answer is a second dispatch, not a callback.** `ask()` parks the action name and its dataset;
  the Confirm button replays it with `ok` set and the second pass falls through. Every `PERM` rule is
  therefore checked twice — a parked question answered by somebody else is refused on the way back in.
- **Pick'em and the Community thread open over the Match page** (`socialBar`). Both are places to spend time,
  not steps in the match, and left inline they pushed the result trail — the thing the page is for — below the
  fold. The page keeps the standing (*12 predictions · You called Byte United*, *4 comments*) and one way in;
  the board and the thread are the modal. Reading is still public: a Guest gets *Read the conversation* and the
  whole thread, and no box to type in. An official gets no way in at all — `pickopen` is not offered and the
  card says why, because whoever decides a result cannot have a stake in it.
- **Popover and Drawer are deliberately absent.** A popover would be a modal that can be missed, and the
  one candidate — the notification bell — already has a real page with a URL. A drawer is a sidebar that
  hides; under 820px the sidebar already reflows into a top bar, which is the same job without the state.
- **Tooltip stays native `title`.** Four uses, all supplementary. A custom tooltip is a hover-only control,
  and hover is not an input method on half the devices this opens on.
- Every modal is `role="dialog" aria-modal="true"`, Escape closes it, and focus moves to the first button
  inside — the destructive card puts Cancel first, so the safe answer is the one already under the keyboard.

## Registration has two doors, one form
A Team Leader who has just read the entry rules and the entry notes is already on the Tournament page.
Sending them back to their Squad page to start a registration there is the long way round to the same form,
so the Tournament page carries an **Entry** panel in the rail: squads in / cap, the rules in force, the
status of any squad of theirs already entered, and one *Register a squad* button (`regfor`).

- **Both doors open `registerForm(t, opts, tr)`.** `opts` is what the tournament field may still be changed to.
  Entering from the Squad page passes every open Tournament and the field is a select; entering from the
  Tournament page passes one, and the field is **stated rather than offered** — a hidden `#rg-tour` keeps
  `recheck` and `dosubmit` reading the same id from either door. Neither door can drift into asking a
  question the other doesn't.
- **A Leader with more than one eligible squad is asked which**, in a chooser that re-enters the same action
  with `data-team` set. One eligible squad skips the question.
- **The panel states closure rather than hiding**: *Closed* once drawn, *Full* at cap, *Not open* while
  private. A Guest is offered **Sign in to enter a squad**, not a button that would bounce.
- `PERM.regfor` repeats every one of those in the order the panel reads them, and `dosubmit` still re-checks
  status, draw, cap, duplicate entry and the hard filter — the door is convenience, never the authority.

## Following is two counts you can open
The Profile header carries **`N followers`** and **`N following`**, and both are buttons (`followBar`).
A number nobody can click is a number nobody can check, so each opens the list behind it (`followList`).

- **Followers** is who follows this player. **Following** is everything they follow — Squads and Players in
  one list, because one list is what the person actually did.
- Each row carries **the same toggle the profile itself carries**, so "am I following them" is answered where
  the question gets asked. Pressed inside a list it redraws the list under your finger rather than closing it.
- Following is **one-way**: nothing to accept, nothing to request, no follower count on a Squad page to farm.
  Your own row never offers a button, and a Guest reads both lists and is offered nothing.
- This replaced a row of `Name x` chips on your own Profile. The chips said the same thing worse, and said it
  only about yourself — the counts say it about anybody, from either Profile.

## Destructive actions
- **Disband a team** — refused outright while the team is in a live draw. Match history always survives, because
  finished tournaments' leaderboards depend on it.
- **Withdraw a registration** — pulled directly while still pending review; once the bracket is drawn it becomes a
  *request* to the Organizer, because withdrawing mid-draw hands an opponent a walkover.
- **Edit a tournament after approval** — venue and date stay editable; sport, format, team cap and eligibility lock
  once squads have been approved against them, and a venue or date change offers to announce itself.

## Leaderboard
- **Single elimination** — ranked strictly by elimination round. No tiebreaker; teams out in the same round share a
  rank. No Lost column: it is always 0 or 1 and carries no information.
- **Double elimination** — ranked by the round of a Team's *second* loss. Lost is always 0 or 2, so it stays out.
- **Round robin** — the Standings table is the Leaderboard: played, won, level, lost, for, against, difference,
  points. Here **Lost and a Level column earn their place**, because they vary.
- Derived on every render in all three, never stored.

## A tie is a real score — and in Round Robin it stands
- A knockout Match **can finish level**; that is what happened, and it is what gets recorded. What settles it is
  recorded beside it: `m.decider = { a, b, kind }`. Football and futsal go to **Penalties**, basketball and
  esports to **Overtime**, volleyball and badminton to a **Tiebreak**, chess to **Armageddon**.
- A level score with no decider is refused, and a decider that is itself level is refused. There is no path to
  a draw standing as a result.
- **One function owns the winner.** `winnerId(m)` reads the decider when the scores are level; the eight places
  that used to compute `m.sa > m.sb` for themselves all call it. That duplication was the reason a decider had
  nowhere to live.
- **Round robin is the exception, and the only one.** A Round Robin Match that ends level is a **Level result**: no
  decider is asked for, and both Teams take a point. Elimination Matches keep the rule above — a level score with no
  decider is refused.
- Form guides carry **W and L** in elimination formats, **W / D / L** in Round Robin.
- **A scoreline is not always goals.** `scoreUnit(sport)` names what is being counted — Goals, Points, Sets,
  Games, Rounds, Result — and the entry form asks for that, so a volleyball 3–1 reads as sets.

## Bracket at scale
- Eight teams or fewer: the full tree.
- Larger draws (up to 32): **the round is the unit of navigation, not the tree.** A round strip doubles as a
  progress indicator; selecting a round shows only its matches in a grid. The full tree stays available for the
  last three rounds and scrolls horizontally.
- **The tree is drawn with its edges** (feedback pass 2). A match is joined to the match its winner feeds by an
  elbow — out from the right of the node, across, down or up, in to the left of the next. The lines are measured
  from the laid-out nodes rather than positioned by hand, so they survive a column of a different height, and they
  are redrawn on resize. They are decoration over a real relationship: the same `nextOf()` edge the result travels
  along, so a line can never disagree with where a winner actually goes.
- Round robin has no tree and gets no lines — its fixtures are a grid per matchday, and the table is the standing.
  In double elimination the drop from winners to losers and the feed into the grand final cross separate bracket
  boxes and are currently left undrawn (`PROGRESS.md` §6).

## Notification
- Polling via TanStack Query `refetchInterval` (per requirement.txt — no WebSocket).
- **A Player is told when they are due to play**: assigning a kick-off to a Match notifies every Player in both
  Squad lists, not only the Leaders — the same widening `CONTEXT.md` already demands of Announcements.
- Bell with unread count → dropdown (last 5-6) → "View all" → full inbox with filters. Organizer announcements
  share the stream with system events, tagged to tell them apart.

## Pick'em / Vote MVP
- Pick'em: login required, pick a winner before kick-off, **one token per correct pick**, personal score (no
  public league). Picks on a match that is not settled are held, not scored — a disputed result must never pay
  out early. The balance sits on the profile: tokens, correct, missed, still open.
- **Whoever decides a result cannot bet on it.** Anyone appointed to a tournament is barred from Pick'em across
  that whole competition, not merely on the matches handed to them, and the control is not rendered for them —
  refusing on click would be a control that lies. The same conflict exists for team leaders and the organizer;
  neither is barred yet. Open.
- Predictions currently close when a result is entered rather than at kick-off. Open.
- Vote MVP: **tournament-level**, opening when the final is confirmed. One vote per user per tournament, closing
  24h later. (An earlier draft made this per match — OF-03 says otherwise.)

---

## Replay links
A **Confirmed** Match may carry a link to video of it, added by that Tournament's Organizer and by nobody else —
one person accountable for what a public page points at, and no moderation queue to build. The system stores and
shows the link; it hosts nothing and checks nothing behind it. Distinct from the live-stream screens, which assume
a stream that is running.

## Community (spec.pdf §14)
- **Comments hang off a match.** Public to read — a guest sees the thread but is not given a box — signed in to
  write, 2 to 500 characters. An author can remove their own; **the organizer of that tournament can remove any**,
  because a thread nobody can moderate is a thread that eventually has to be switched off.
- **Feedback is written to the organizer, not published.** One review per person per tournament, 1–5 plus a note,
  and sending again replaces it. The **rating is public in aggregate** — an organizer's record should follow the
  tournament — while the **notes are visible only to the organizer**, on their Manage tab, so people say what they
  actually think. The organizer cannot review their own tournament.
- Both live on a `community` tab beside bracket / schedule / leaderboard / announcements.

## Working patterns carried from desktop clients
These are behaviour, not paint, and each earns its place:
- **"Needs you"** on the front page — every outstanding action across every role a person holds, one line each,
  each a link to the page that clears it. Derived on render; nothing is stored, so it cannot go stale.
- **The tournament list is filtered, not scrolled** — free text over name, sport and venue, plus a sport chip row.
  "Nothing matched X" is a different state from "nothing here".
- **Command palette** on `Ctrl`/`⌘`+`K`, built from the same `visibleTo()` the pages use, so it can never offer a
  door that then refuses to open. `?` lists every shortcut. `Esc` closes.
- **Undo, not just confirm.** A `confirm()` asks before and is easy to click through; an undo forgives after.
  Nine destructive actions snapshot state first and offer Undo in a toast that lives 9s instead of 4.2s. The
  snapshot is taken in the sealing wrapper every action already passes through, so no handler knows about it.
- **Skip to the main content** is the first tab stop, and `#app` sits above any backdrop so a decorative layer
  can never take a click — the login screen renders without the shell and was the one page that proved it.
- Times read as "3h ago" with the exact stamp kept in the `title`.

## Screen list — 77 screens

Reconciled against the five user story maps and the four SRS flowcharts (OF-01 team, OF-02 registration &
draw, OF-03 check-in and OF-03 results, plus the organizer lifecycle).

| Group | Count | Screens |
|---|---|---|
| **Guest · public** | 12 | landing · bracket round view · bracket full tree · schedule · leaderboard · announcements · **live stream** · **replays** · **browse by sport** · search · player profile · team profile |
| **Auth** | 5 | register · login · forgot · reset · verify email |
| **Shared states** | 9 | profile (student record is read-only — the registry owns it) · loading · validation · success & toasts · error · empty · user menu & sign out · 403 · 404 |
| **Organizer** | 15 | request to organize · my tournaments · tournament detail · edit tournament · **schedule editor** · **venues & pitches** · **questions inbox** · post announcement · registered teams · soft-filter review · **hard-filter rejections** · referee roster · assign referee · bracket draw · dispute resolution |
| **Admin** | 7 | pending requests · all tournaments · user management · **system overview** · **user permissions** · **permanent team requests** · **transfer team management** |
| **Check-in** | 3 | **on-site (player QR scan)** · **online (ID photo)** · **referee check-in console** |
| **Team Leader** | 9 | create team · roster (Forming) · register team (hard filter) · **join with a code** · **squad documents** · my registrations · withdraw · team settings · confirm/dispute on-site |
| **Player** | 3 | team invitation · my team · my schedule |
| **Referee** | 3 | **invitations** · my assigned matches · **export report** |
| **Phase 2** | 8 | notification dropdown · inbox · dashboard · Pick'em · **tournament MVP** · **following** · **rate & review** · **badges** |
| **Cross-role** | 3 | match detail · **online submission** · all role variants |

**Bold** = added or rewritten in the story-map reconciliation pass.

Feedback pass 1 added eight more, all inside pages that already existed rather than as new
destinations: **arrange the draw** and **fixtures** (kick-off, venue, officials per match) on the
organizer's Manage tab, **entry notes** there and on the public tournament page, **squad list** in the
registration modal, **lineup** on a match, **replay link** on a confirmed match, and **permanent squad
requests** in the admin queue. Round robin replaces the bracket with a matchday list and a table;
double elimination shows two trees and a grand final.

Feedback pass 2 added no new destination at all. It put a **hard filter** panel on the organizer's
Manage tab — the rules in force, plus *Request a change* — and its **approve/decline queue** on the
admin page beside the permanent-squad one; drew the **connecting edges** on the bracket; and gave the
**Team page** its logo. Its other five items were already built, and reading them as new work would
have meant rebuilding what shipped in pass 1 (`PROGRESS.md` §5b).

### Still out of scope
Live-stream *ingest* is not designed — the screens assume a stream URL exists. Forfeits, third-place matches and
best-of-N remain unasked-for. Double elimination and round robin **left this list in feedback pass 1**; see
"Three formats, one Draw".

## Permission matrix
Derived from role definitions in `requirement.txt` §2. The only judgement call beyond them is Match visibility
for Guests, decided above.

## Implementation notes carried from the mockup
- Controls are real `<button>` elements — keyboard reachable, focus ring visible. Icon-only controls carry a label
  and a target of at least 40×40 (Fitts; WCAG 2.2 SC 2.5.8 asks 24×24).
- `prefers-reduced-motion` disables every transition. The animated background canvas is **gone** — it cost a
  `requestAnimationFrame` loop for decoration nobody was reading, and it used to swallow clicks on the login page.
  Nothing may reintroduce a frame loop; a test asserts the string is absent. Work that has to measure a laid-out
  box reads it directly and accepts the synchronous reflow.
- **One measure for the content column.** The top bar bleeds the full width so its lower edge reads as an edge,
  but the bar's *contents* carry the same `max-width` and padding as `main`. Otherwise the avatar sits against the
  window while the content it belongs to stops several hundred pixels short of it.
- Desktop only, English only, per requirement.txt §11 and §12.

## Builds
| File | Skin | Notes |
|---|---|---|
| `ltms-prototype.html` | Tactical — near-black, vermillion | The one the suites read. Canonical |
| `ltms-prototype-v2.html` | Street — plum, coral, acid, sticker edges | From `NEW_UI` + Zenless Zone Zero |
| `ltms-prototype-v3.html` | Editorial — cream, plum ink, rose | From the rose palette in `NEW_UI` |

v2 and v3 are **skins, not forks**: the `<script>` block is byte-identical to v1, and a test asserts it. They are
made by swapping the `:root` token block and appending a layer at the end of the stylesheet. Change v1's logic and
both must be regenerated — the suite fails until they are. That carry is `node sync-skins.js`, which copies v1's
script into both and leaves each stylesheet and `<title>` alone. Run it before running the suite.
