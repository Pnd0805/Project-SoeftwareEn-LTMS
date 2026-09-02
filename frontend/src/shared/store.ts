/**
 * src/shared/store.ts
 *
 * One mutable state object, a version counter, and `useSyncExternalStore` —
 * the same shape the prototype had (`S` + `save()` + `render()`), which is why
 * every action below reads like the handler it was ported from.
 *
 * ponytail: no reducer, no immutable updates, no Zustand. The app is one user
 * driving one dataset; if two tabs ever have to agree, swap the module-level
 * object for the API client and the components do not change.
 */
import { useSyncExternalStore } from 'react'
import { SEED } from './seed'
import { NOW } from './rules'
import type { State, Tournament } from './types'

const KEY = 'ltms.v1'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as State
      if (parsed && Array.isArray(parsed.tournaments) && parsed.tournaments.length) return parsed
    }
  } catch { /* a corrupt or blocked store just reseeds */ }
  return SEED()
}

let state: State = load()
let version = 0
const listeners = new Set<() => void>()

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode */ }
}
/** Every action ends here: persist, bump, repaint. */
function commit() {
  version++
  save()
  listeners.forEach(l => l())
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** Read the store. Components re-render when any action commits. */
export function useLtms(): State {
  useSyncExternalStore(subscribe, () => version, () => version)
  return state
}

export const getState = () => state

export function resetDemo() {
  state = SEED()
  commit()
  toast('Demo data reset', 'warn')
}

const uid = (p: string) => `${p}-${++state.seq}`

/* ───────── toasts ───────── */
export interface Toast { id: number; text: string; kind: 'ok' | 'warn' | 'crit' }
let toasts: Toast[] = []
let toastSeq = 0
const toastListeners = new Set<() => void>()
let toastVersion = 0
const emitToasts = () => { toastVersion++; toastListeners.forEach(l => l()) }

export function toast(text: string, kind: Toast['kind'] = 'ok') {
  const id = ++toastSeq
  toasts = [...toasts, { id, text, kind }]
  emitToasts()
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); emitToasts() }, kind === 'ok' ? 4200 : 6000)
}
export function useToasts(): Toast[] {
  useSyncExternalStore(
    (l) => { toastListeners.add(l); return () => { toastListeners.delete(l) } },
    () => toastVersion,
    () => toastVersion,
  )
  return toasts
}

/* ───────── notifications ───────── */
function notify(to: string | null | undefined, text: string, href = '') {
  if (!to) return
  state.notifications.unshift({ id: uid('n'), to, text, href, at: NOW(), read: false })
}
const notifyAll = (ids: (string | null | undefined)[], text: string, href = '') =>
  [...new Set(ids.filter(Boolean))].forEach(id => notify(id, text, href))

/* ───────── session ───────── */
export const GUEST = 'guest'

export function login(id: string) {
  state.session = id
  commit()
}
export function continueAsGuest() {
  state.session = GUEST
  commit()
}
export function signout() {
  state.session = null
  commit()
}

/* ───────── teams ───────── */
export function createTeam(input: { name: string; code: string; sport: string; color: string }, leader: string) {
  const id = uid('t')
  state.teams.push({
    id, name: input.name, code: input.code.toUpperCase().slice(0, 3), color: input.color,
    sport: input.sport, leader, members: [leader], created: NOW(), disabled: false, permanent: false,
  })
  commit()
  toast(`${input.name} created — invite players to make it Ready`)
  return id
}

/** Adding a Player creates an Invitation, never a membership. */
export function invitePlayer(teamId: string, userId: string) {
  const tm = state.teams.find(t => t.id === teamId)
  if (!tm || tm.members.includes(userId)) return
  if (state.invites.some(i => i.team === teamId && i.user === userId && i.status === 'pending')) return
  state.invites.push({ id: uid('i'), team: teamId, user: userId, status: 'pending' })
  notify(userId, `${tm.name} invited you to join the squad.`, '/teams')
  commit()
  toast('Invitation sent — it counts once they accept')
}

export function answerInvite(inviteId: string, accept: boolean) {
  const inv = state.invites.find(i => i.id === inviteId)
  if (!inv) return
  inv.status = accept ? 'accepted' : 'declined'
  const tm = state.teams.find(t => t.id === inv.team)
  if (accept && tm && !tm.members.includes(inv.user)) {
    tm.members.push(inv.user)
    notify(tm.leader, `${state.users.find(u => u.id === inv.user)?.name ?? 'A player'} joined ${tm.name}.`, `/team/${tm.id}`)
  }
  commit()
  toast(accept ? 'Joined the squad' : 'Invitation declined', accept ? 'ok' : 'warn')
}

/** Roster lock: a squad holding an approved registration in a live tournament. */
export function rosterLock(teamId: string): Tournament | null {
  const reg = state.registrations.find(r => r.team === teamId && r.status === 'approved')
  if (!reg) return null
  const tr = state.tournaments.find(t => t.id === reg.tour)
  return tr && !tr.champion ? tr : null
}

export function kickPlayer(teamId: string, userId: string) {
  const tm = state.teams.find(t => t.id === teamId)
  if (!tm) return
  const lock = rosterLock(teamId)
  if (lock) { toast(`${tm.name} is locked — it holds an approved place in ${lock.name}`, 'crit'); return }
  tm.members = tm.members.filter(id => id !== userId)
  commit()
  toast('Player removed')
}

export function transferLeader(teamId: string, userId: string) {
  const tm = state.teams.find(t => t.id === teamId)
  if (!tm || !tm.members.includes(userId)) return
  tm.leader = userId
  notify(userId, `You are now the leader of ${tm.name}.`, `/team/${tm.id}`)
  commit()
  toast('Leadership transferred — membership is unchanged')
}

export function disbandTeam(teamId: string) {
  const tm = state.teams.find(t => t.id === teamId)
  if (!tm) return
  const lock = rosterLock(teamId)
  if (lock) { toast(`${tm.name} is locked until ${lock.name} names a champion`, 'crit'); return }
  state.teams = state.teams.filter(t => t.id !== teamId)
  state.registrations = state.registrations.filter(r => r.team !== teamId)
  commit()
  toast(`${tm.name} disbanded`, 'warn')
}

export function requestPermanent(teamId: string, reason: string, by: string) {
  state.permanentRequests.push({ id: uid('pr'), team: teamId, by, reason, at: NOW(), status: 'pending' })
  notifyAll(state.users.filter(u => u.role === 'Admin').map(u => u.id),
    `${state.teams.find(t => t.id === teamId)?.name ?? 'A squad'} asked to be made permanent.`, '/admin')
  commit()
  toast('Sent to an admin — exemption is a judgement, not a checkbox')
}

export function decideTournament(trId: string, approve: boolean) {
  const tr = state.tournaments.find(t => t.id === trId)
  if (!tr) return
  tr.status = approve ? 'private' : 'pending'
  if (!approve) state.tournaments = state.tournaments.filter(t => t.id !== trId)
  notify(tr.organizer, approve
    ? `${tr.name} was approved. Appoint your referees, then open it to the public.`
    : `${tr.name} was declined.`, approve ? `/t/${tr.id}/manage/progress` : '/')
  commit()
  toast(approve ? 'Approved — it is the organizer\'s draft now' : 'Request declined', approve ? 'ok' : 'warn')
}

export function appointReferee(trId: string, userId: string) {
  const tr = state.tournaments.find(t => t.id === trId)
  if (!tr) return
  if (state.refInvites.some(i => i.tour === trId && i.user === userId && i.status === 'pending')) return
  state.refInvites.push({ id: uid('ri'), tour: trId, user: userId, status: 'pending' })
  notify(userId, `${state.users.find(u => u.id === tr.organizer)?.name} asked you to officiate ${tr.name}.`, '/matches')
  commit()
  toast('Invitation sent — it counts only once it is answered')
}

export function answerAppointment(inviteId: string, accept: boolean) {
  const inv = state.refInvites.find(i => i.id === inviteId)
  if (!inv) return
  inv.status = accept ? 'accepted' : 'declined'
  const tr = state.tournaments.find(t => t.id === inv.tour)
  if (tr && accept && !tr.referees.includes(inv.user)) tr.referees.push(inv.user)
  notify(tr?.organizer, `${state.users.find(u => u.id === inv.user)?.name} ${accept ? 'accepted' : 'declined'} your appointment for ${tr?.name}.`, `/t/${inv.tour}/manage/referees`)
  commit()
  toast(accept ? 'You are officiating this tournament' : 'Appointment declined', accept ? 'ok' : 'warn')
}

export function removeReferee(trId: string, userId: string) {
  const tr = state.tournaments.find(t => t.id === trId)
  if (!tr) return
  tr.referees = tr.referees.filter(id => id !== userId)
  state.refInvites = state.refInvites.filter(i => !(i.tour === trId && i.user === userId))
  commit()
  toast('Removed from this tournament', 'warn')
}

export function decideFilterChange(trId: string, approve: boolean) {
  const tr = state.tournaments.find(t => t.id === trId)
  if (!tr?.filterChangeRequest) return
  if (approve) tr.rules = tr.filterChangeRequest.rules
  tr.filterChangeRequest = null
  notify(tr.organizer, `Your entry-condition change for ${tr.name} was ${approve ? 'approved' : 'declined'}.`, `/t/${tr.id}/manage/entry`)
  commit()
  toast(approve ? 'Conditions changed' : 'Change declined', approve ? 'ok' : 'warn')
}

export function decidePermanent(reqId: string, approve: boolean) {
  const req = state.permanentRequests.find(r => r.id === reqId)
  if (!req) return
  req.status = approve ? 'approved' : 'declined'
  const tm = state.teams.find(t => t.id === req.team)
  if (tm && approve) tm.permanent = true
  notify(req.by, `Your permanent-squad request for ${tm?.name} was ${approve ? 'approved' : 'declined'}.`, `/team/${req.team}`)
  commit()
  toast(approve ? 'Exempted from automatic disabling' : 'Request declined', approve ? 'ok' : 'warn')
}

/* ───────── community ───────── */
export function postComment(matchId: string, by: string, text: string) {
  if (!text.trim()) return
  state.comments.push({ id: uid('c'), match: matchId, by, text: text.trim(), at: NOW() })
  commit()
}
export function removeComment(commentId: string) {
  state.comments = state.comments.filter(c => c.id !== commentId)
  commit()
  toast('Comment removed', 'warn')
}

/** One correct prediction pays one Token. Officials cannot predict in their own. */
export function placePick(matchId: string, by: string, teamId: string) {
  const existing = state.picks.find(p => p.match === matchId && p.by === by)
  if (existing) existing.team = teamId
  else state.picks.push({ id: uid('p'), match: matchId, by, team: teamId })
  commit()
  toast('Call recorded')
}

/** One vote per User per Tournament, opened the moment a Champion is decided. */
export function voteMvp(trId: string, by: string, player: string) {
  if (state.votes.some(v => v.tour === trId && v.by === by)) { toast('You have already voted in this tournament', 'warn'); return }
  state.votes.push({ id: uid('v'), tour: trId, by, player })
  commit()
  toast('Vote cast — one per person, and it cannot be changed')
}

/** A rating is public in aggregate; the note is read only by the Organizer. */
export function toggleFollow(key: string) {
  state.follows = state.follows.includes(key)
    ? state.follows.filter(k => k !== key)
    : [...state.follows, key]
  commit()
}

export function markAllRead(userId: string) {
  state.notifications.filter(n => n.to === userId).forEach(n => { n.read = true })
  commit()
}
export function markRead(id: string) {
  const n = state.notifications.find(x => x.id === id)
  if (n) { n.read = true; commit() }
}
