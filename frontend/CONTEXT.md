# LTMS (Local Tournament Management System)

Front-end domain glossary for the tournament management app. Single context — no sub-domains split.

## Language

**Tournament**:
A single-elimination competition instance, owned by one Organizer, moving through statuses Pending → Private → Public.
_Avoid_: Event, competition (use Tournament)

**Organizer**:
A User granted management rights over one specific Tournament after Admin approves their request. Not a global role — scoped per Tournament.
_Avoid_: Admin (different role, see below)

**Admin**:
Approves/rejects Organizer requests and manages the system globally. Does not manage individual Tournaments.

**Referee**:
A User appointed by an Organizer to a specific Tournament, and separately assigned to the individual Matches they
will officiate — see Match assignment. **Not a role and not a permission** — any student can be
asked; the Organizer searches the roll by name and invites, and the appointment counts only once accepted. Scoped
per Tournament, like Organizer.
_Avoid_: Officiate permission, referee role (there is nothing to grant)

**Team Leader**:
Creates a Team, adds Players, registers the Team into a Tournament, and confirms/disputes Match results on behalf of the Team.

**Player**:
A Team member with no management rights — read-only view of their Team and its Matches.

**Squad list**:
The subset of a Team the Leader enters into one Tournament, chosen at registration. The **Hard filter reads this
list, not the whole Team** — a member left off cannot fail it, because they are not entering. Fixed once the
registration is approved.
_Avoid_: Team sheet, roster (say which of the two lists you mean)

**Lineup**:
Who from the Squad list plays one Match, split into **Starters** and **Substitutes**, named by the Team Leader before
kick-off. Check-in applies to the Lineup, and only a named Player can carry statistics for that Match. A Team with no
Lineup fields its Starters from the previous Match — the Leader is never blocked from playing by paperwork.

**Guest**:
An unauthenticated viewer. Read-only access to public Tournament data (bracket, schedule, Leaderboard, Match results at any status).

**Hard filter**:
The system's automatic check of every Player on the Squad list against a Tournament's entry conditions
(gender / age / faculty / major / year of study). **Every condition is optional** — a Tournament that sets no age
range admits every age, and an unset condition is not a condition that always fails. Failing it **rejects the registration outright** and names who failed. No Organizer can override it.
_Avoid_: Eligibility flag, red flag (an earlier advisory model, now dead)

**Hard filter change request**:
An Organizer's request to an Admin to alter a Tournament's entry conditions after it was approved. The conditions are
set once, at creation, and enforced with no override — so the Organizer who wants them changed asks with a reason and
an Admin decides — the same asked-and-decided shape as a **Permanent team**. It exists because the alternative is an
Organizer quietly widening the rules once they see who registered, which is the thing the Hard filter is for.
_Avoid_: Editing the filter, overriding the filter (nobody edits it in place)

**Entry notes**:
Free text an Organizer writes about what they expect of an entrant beyond the Hard filter — kit, paperwork, conduct,
anything the entry rules cannot express as a field. Written while the Tournament is being set up, alongside
appointing Referees, and published on the Tournament page so a Team Leader reads it before registering. The system
never checks it; it only shows it.
_Avoid_: Soft filter rules, criteria (the system enforces nothing here)

**Soft filter**:
The Organizer's review of a registration that already cleared the Hard filter — judged against the Entry notes and
anything else the entry rules cannot express as a field. The only human judgement in team approval. The Entry notes
are what the Organizer is reading against; the Soft filter is the reading.

**Check-in**:
A Player marking themselves present for a Match before it opens — on-site that is signing in plus scanning the Organizer's rotating QR, online it is one click, no separate proof captured. Either way it is self-service, not a Referee action: a Referee's only lever is after the fact, marking a checked-in Player ineligible, which is reported to the Organizer.
_Avoid_: "ID photo verification" (describes the real system this prototype stands in for, not this prototype — no photo is captured or reviewed here; see PRODUCT.md's document-upload scope note)

**Team status**:
**Forming** until the squad meets the minimum size **for its sport** — a Team names its sport when it is created and
the system sets the minimum from that, so a five-a-side squad is not judged by an eleven-a-side rule — then **Ready**
and usable for registration. A team that enters no Tournament within two weeks of creation, or goes six months idle, is disabled automatically.

**Permanent team**:
A Team exempted by an Admin from automatic disabling. For standing clubs, not for squads avoiding the deadline. The
Leader asks for it with a reason and an Admin decides — the same queue as a Tournament request, so exemption stays a
judgement rather than a checkbox a squad ticks to dodge the deadline.

**Invitation**:
A Team Leader's request for a User to join their Team. Pending until the User accepts — adding a Player creates an Invitation, never a membership, because accepting exposes the Player's eligibility data to the Tournament's Organizer.
_Avoid_: Add player (that is the Leader's action, not the resulting state)

**Roster lock**:
A Team cannot be kicked from or disbanded while it holds an approved registration in a Tournament that has not yet named a Champion — locked from the moment that registration is approved, not only once the Draw happens, and it stays locked even if this Team is later eliminated from that Tournament (the lock tracks the Tournament's outcome, not this Team's). The Squad list is a snapshot the system depends on staying intact for the Tournament's run, and disbanding it mid-run is exactly as disruptive as emptying the roster would be. Transferring the Team Leader is deliberately exempt — it changes no membership and no headcount, and locking it too would leave a Team with an unresponsive Leader stuck for the Tournament's entire remaining run with no way to reassign authority, which is worse than the risk the lock exists to prevent. Sending a new Invitation is unaffected for the same reason: a new member cannot enter an already-approved Squad list, so recruiting carries none of that risk either.
_Avoid_: "Active competition," "in a tournament" (name the Squad-list-approval trigger, not a vague state)

**Announcement**:
A message written by an Organizer about one Tournament. Published on the Tournament's public page and pushed to every participant's Notification inbox at once. Distinct from a Notification, which the system generates.

**Venue**:
Where an onsite Match is played — a name plus a **map pin**, a latitude and longitude the Organizer sets by pasting
a Google Maps link or dropping a pin. Stored as coordinates and rendered as a link out to Google Maps, never as an
embedded map, so the page still works with no network. A Tournament carries a default Venue and any Match may
override it, because courts differ. An online Match has none.

**Room code**:
The in-game lobby ID for an online Match (e.g. a custom-room number in a title like ROV) — not a place, and not a Venue: joining it is how the two squads land in the same online session, nothing physical about it. A Referee records it, entered from the Check-in page, once the game client has actually generated it; optional and unenforced, the same as every other piece of paperwork in this system — a Match is never blocked on it. Visible to both squads once set, the same visibility tier as kick-off time.
_Avoid_: "Room number" (the tester's own phrase, and the term a game client shows in its UI, but reads as a physical room next to Venue — "Room code" keeps the two apart), "Venue for online matches" (Venue is explicitly onsite-only; this is a distinct concept, not an online variant of it)

**Onsite match / Online match**:
Both channels have the same two steps; who performs each one swaps. **Onsite**: two Referees minimum record the score and statistics, then the **winning** Team Leader confirms — the losing side does not sign off, it disputes. **Online**: the **winning** Team Leader submits, then the **Referee** confirms. There is no Dispute on an online match: the Referee's check before confirmation is the recourse (OF-03).

**Tournament format**:
How a Tournament decides its champion — **Single Elimination**, **Double Elimination** or **Round Robin**. Chosen
when the Tournament is requested and fixed once the Draw is made. It is the term that decides whether a Tournament
has a Bracket or a Standings table, whether a Match may end level, and how the Leaderboard is derived.
_Avoid_: Tournament type (that is the sport), mode

**Match assignment**:
The Organizer's placement of a kick-off time, a Venue and named Referees on one Match, done after the Draw. **A
Referee may record a Match only if assigned to it** — appointment to the Tournament makes someone eligible, this
makes them responsible. Onsite needs two assigned, online one. Reassignment is open until that Match starts.

**Bracket**:
The match tree for an elimination Tournament — Single or Double. Generated once registration closes, either by
random Draw or arranged by hand by the Organizer. A Round Robin has no Bracket; it has a Standings table instead.

**Losers bracket**:
The second tree of a Double Elimination Tournament, holding every Team on its first loss. A Team is out on its
second. The two brackets meet once, in a single Grand final — whoever wins that Match is Champion, with no rerun
for the Team arriving from the Losers bracket.
_Avoid_: Lower bracket, consolation round, Bracket reset (there is none)

**Draw**:
The act of placing approved Teams into their starting positions — random by default, or arranged by hand by the
Organizer, who may keep rearranging slots until the first Match of the Tournament starts. From that moment the Draw
is **locked**: check-in, a recorded score or a published kick-off all count as started. Applies to every format.
Not to be confused with a level Match result, which this glossary calls a **Level result**.
_Avoid_: Seeding (that is one input to a Draw, not the act), Bracket generation

**Standings**:
The running table of a Round Robin — played, won, level, lost, Score unit for and against, and points. Three points
for a win, one for a Level result, none for a loss. Teams level on points are separated in this order: **Score
difference, then Score units scored, then the result between the tied Teams**. Teams still level after all three
share the rank — the table says so rather than inventing a fourth rule. Exists only in Round Robin, and it is what
the Leaderboard reads there in place of an elimination round.

**Champion**:
The Team that finishes a Tournament first, and the moment the Tournament is over. In an elimination format it is the
winner of the last Match in the Bracket; in a Round Robin it is the Team at the top of the Standings once every Match
is Confirmed. Two Teams that finish level at the top after every tiebreaker are settled by the Organizer, who records
which one is Champion and why — the only place a human ranks a Round Robin.

**Replay link**:
A link to video of a Match that is already Confirmed, added by that Tournament's Organizer. The system stores and
shows the link; it hosts nothing and checks nothing behind it.
_Avoid_: VOD, stream (a Replay link points at a finished Match, a stream at a live one)

**Match result status**:
Pending Confirmation → (optionally) Disputed → Confirmed. Set by Referee, acted on by Team Leaders, resolved by
Organizer if Disputed. A result nobody confirms stalls the whole Tournament, so the **Organizer may confirm a
Pending result themselves** — recorded as their decision, with their name on it, never silently.
_Avoid_: Match state (use "status" for consistency with Tournament status)

**Dispute**:
A Match result contested by a Team Leader, recorded against **the Team** that contested it and named that way
everywhere it is shown — the person is who clicked, the Team is who objects — **onsite matches only**, enforced, not merely documented — resolved by the Organizer with final authority.

**Leaderboard**:
Per-Tournament ranking, derived from the Tournament format and never stored. In **Single Elimination** it is the
round a Team was eliminated in — Teams out in the same round share a rank, no tiebreaker. In **Double Elimination**
it is the round of a Team's second loss. In **Round Robin** it is the Standings table.

**Decider**:
What settles a **knockout** Match that finished level — penalties, overtime, a tiebreak, Armageddon. Recorded beside
the score, never instead of it: `1–1 (4–2 Penalties)` is the record, because `2–1` never happened. A Round Robin
Match needs no Decider: it is recorded as a Level result and both Teams take a point.
_Avoid_: Draw (that word means the placement of Teams, see above), Extra time (name the decider the sport actually uses)

**Level result**:
A Match that ended with the scores equal. In an elimination Match a Decider must follow it; in a Round Robin it
stands as the final record.

**Player statistic**:
A figure a Referee records against one named Player in one Match. Which figures exist is decided by the sport and by
nothing else — Football counts Goals, Assists, Yellow cards and Red cards; VALORANT counts Kills, Deaths, Assists,
First kills, Plants and Defuses; Chess counts none, and the sheet says so. Never summed across sports.

**Team statistic**:
A figure about one Team in one Match. Where it is the sum of its Players it is **derived, never typed** — team goals,
team cards, team kills. Where no sum can produce it, the Referee enters it: points per Quarter, Maps and Rounds won,
Deuce and Rally counts. A figure that can be derived and typed both ways is a disagreement waiting to happen, so the
sport names each figure as one or the other.
_Avoid_: Match stats (say whose)

**Score unit**:
What a scoreline counts, which is not the same in every sport — Goals, Points, Sets, Games, Rounds, Result. The
entry form asks for the unit by name so a volleyball 3–1 is read as sets.

**Major**:
The department inside a Faculty. Part of a Tournament's entry conditions and checked by the Hard filter, because a
faculty cup and a departmental one are different competitions.

**Comment**:
A signed-in User's public remark under one Match. Guests read; only signed-in users write. Removable by its author
or by the Organizer of that Tournament.
_Avoid_: Post, reply (there are no threads inside a thread)

**Feedback**:
A User's review of how a Tournament was run — a 1-to-5 rating and a note, one per person per Tournament, replaced
rather than stacked when sent again. The **rating is public in aggregate; the note is read only by the Organizer**.
Distinct from a Comment, which is about a Match and is public.

**Token**:
What a correct Pick'em prediction pays. One per prediction that comes in. A pick on a Match that is not Confirmed
is held, not scored. Anyone officiating a Tournament cannot predict in it at all.

**Work queue**:
The "Needs you" list on the front page — everything outstanding across every role a User holds, derived on every
render rather than stored, so it can never disagree with the state it describes.

**Pick'em**:
A logged-in User's prediction of a Match winner, submitted before the Match starts. Each correct prediction pays one
Token. Anyone officiating that Tournament is barred from predicting anywhere in it — whoever decides a result cannot
hold a stake in it.

**Vote MVP**:
A logged-in User's vote for a **Tournament's** most valuable player. It opens at one moment only — when the Champion is decided — and candidates are ranked on referee-recorded statistics from the whole competition. One vote per User per Tournament. Pick'em is the per-match one.
_Avoid_: Per-match MVP (an earlier draft, overruled by OF-03)
