/**
 * src/shared/selectors.ts
 *
 * The prototype's lookup block. Everything a page asks about "me" lives here so
 * a rule like `visibleTo` has exactly one definition — it used to live in three
 * views separately, which is how the search page came to list private drafts.
 */
import type { Match, State, Team, Tournament, User } from './types'
import { GUEST } from './store'
import { refsNeeded } from './rules'

export const me = (s: State): User | null => s.users.find(u => u.id === s.session) ?? null
export const isGuest = (s: State) => s.session === GUEST
export const signedIn = (s: State) => !!me(s)
export const sid = (s: State) => me(s)?.id ?? null

export const user = (s: State, id?: string | null) => s.users.find(u => u.id === id)
export const team = (s: State, id?: string | null) => s.teams.find(t => t.id === id)
export const tour = (s: State, id?: string | null) => s.tournaments.find(t => t.id === id)
export const match = (s: State, id?: string | null) => s.matches.find(m => m.id === id)

export const matchesOf = (s: State, trId: string): Match[] =>
  s.matches.filter(m => m.tour === trId).sort((a, b) => a.round - b.round || a.slot - b.slot)
export const regsOf = (s: State, trId: string) => s.registrations.filter(r => r.tour === trId)
export const commentsOf = (s: State, matchId: string) =>
  s.comments.filter(c => c.match === matchId).sort((a, b) => a.at - b.at)

export const myTeams = (s: State): Team[] => {
  const u = me(s)
  return u ? s.teams.filter(t => t.members.includes(u.id)) : []
}
export const ledTeams = (s: State): Team[] => {
  const u = me(s)
  return u ? s.teams.filter(t => t.leader === u.id) : []
}

export const isOrg = (s: State, t?: Tournament | null) => !!t && me(s)?.id === t.organizer
export const isAdmin = (s: State) => me(s)?.role === 'Admin'
export const isRef = (s: State, t?: Tournament | null) => !!t && !!me(s) && (t.referees || []).includes(me(s)!.id)
/** Whoever decides a result cannot hold a stake in it. */
export const officiates = (s: State, trId: string) => {
  const u = me(s)
  const t = tour(s, trId)
  if (!u || !t) return false
  return t.organizer === u.id || (t.referees || []).includes(u.id)
}

/**
 * Does this tournament exist, as far as you are concerned. A request under
 * review is not a tournament yet and a private one is its organizer's draft.
 */
export const visibleTo = (s: State, t: Tournament) =>
  t.status === 'public' || (!!me(s) && (t.organizer === me(s)!.id || me(s)!.role === 'Admin'))

export const unread = (s: State) => {
  const u = me(s)
  return u ? s.notifications.filter(n => n.to === u.id && !n.read).length : 0
}

export const isFollowing = (s: State, key: string) => s.follows.includes(key)

/** Which tournaments this squad could still enter. */
export const openToEnter = (state: State, t: Team) =>
  state.tournaments.filter(x => x.status === 'public' && !x.drawn
    && state.registrations.filter(r => r.tour === x.id && r.status === 'approved').length < x.cap
    && !state.registrations.some(r => r.tour === x.id && r.team === t.id && r.status !== 'withdrawn'))

/** And which of my squads could still enter this tournament — same question, other end. */
export const squadsFor = (s: State, tr: Tournament) => {
  const u = me(s)
  if (!u) return []
  return s.teams.filter(x => x.leader === u.id && !x.disabled
    && !s.registrations.some(r => r.tour === tr.id && r.team === x.id && r.status !== 'withdrawn'))
}

/** Matches this user may record — appointment makes you eligible, assignment responsible. */
export const myAssignments = (s: State) => {
  const u = me(s)
  return u ? s.matches.filter(m => (m.refs || []).includes(u.id)) : []
}

export const refShortfall = (t: Tournament) => refsNeeded(t) - (t.referees || []).length
