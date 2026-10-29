/**
 * src/shared/career.ts
 *
 * A person competes in more than one sport, so a single career total is
 * meaningless — six goals at football and six points at basketball are not
 * twelve of anything. Everything here keys on the sport of the tournament the
 * match belonged to, and is never summed across sports.
 */
import { leaderboard, lineupOf, statLabels, winnerId } from './rules'
import type { State } from './types'

export interface SportRow {
  sport: string
  p: number
  w: number
  gf: number
  ga: number
  goals: number
  assists: number
  form: string[]
  tours: Set<string>
}

const blank = (sport: string): SportRow =>
  ({ sport, p: 0, w: 0, gf: 0, ga: 0, goals: 0, assists: 0, form: [], tours: new Set() })

/** Every confirmed match a player actually appeared in, grouped by sport. */
export function careerBySport(s: State, pid: string): SportRow[] {
  const by = new Map<string, SportRow>()
  s.matches.filter(m => m.status === 'confirmed' && m.note !== 'bye').forEach(m => {
    const tr = s.tournaments.find(t => t.id === m.tour)
    if (!tr) return
    const side = [m.a, m.b].find(tid => tid && lineupOf(s, m, tid).includes(pid))
    if (!side) return
    const row = by.get(tr.sport) ?? blank(tr.sport)
    const mine = side === m.a ? m.sa : m.sb
    const theirs = side === m.a ? m.sb : m.sa
    row.p++
    row.gf += mine ?? 0
    row.ga += theirs ?? 0
    row.tours.add(tr.id)
    const won = winnerId(m) === side
    if (won) row.w++
    row.form.push(won ? 'W' : winnerId(m) ? 'L' : 'D')
    const st = m.stats?.[pid]
    if (st) { row.goals += st.goals; row.assists += st.assists }
    by.set(tr.sport, row)
  })
  return [...by.values()].sort((a, b) => b.p - a.p)
}

/** The same, for a squad — a club can field sides in several sports. */
export function teamBySport(s: State, tid: string): SportRow[] {
  const by = new Map<string, SportRow>()
  s.matches.filter(m => (m.a === tid || m.b === tid) && m.status === 'confirmed' && m.note !== 'bye').forEach(m => {
    const tr = s.tournaments.find(t => t.id === m.tour)
    if (!tr) return
    const row = by.get(tr.sport) ?? blank(tr.sport)
    const mine = m.a === tid ? m.sa : m.sb
    const theirs = m.a === tid ? m.sb : m.sa
    row.p++
    row.gf += mine ?? 0
    row.ga += theirs ?? 0
    row.tours.add(tr.id)
    const won = winnerId(m) === tid
    if (won) row.w++
    row.form.push(won ? 'W' : winnerId(m) ? 'L' : 'D')
    by.set(tr.sport, row)
  })
  return [...by.values()].sort((a, b) => b.p - a.p)
}

export interface TourRow { tour: string; name: string; sport: string; p: number; w: number; finish: string }

/** What a player did in each tournament, and where their squad finished it. */
export function careerByTournament(s: State, pid: string): TourRow[] {
  const rows = new Map<string, TourRow>()
  s.matches.filter(m => m.status === 'confirmed' && m.note !== 'bye').forEach(m => {
    const tr = s.tournaments.find(t => t.id === m.tour)
    if (!tr) return
    const side = [m.a, m.b].find(tid => tid && lineupOf(s, m, tid).includes(pid))
    if (!side) return
    const row = rows.get(tr.id) ?? { tour: tr.id, name: tr.name, sport: tr.sport, p: 0, w: 0, finish: '—' }
    row.p++
    if (winnerId(m) === side) row.w++
    row.finish = leaderboard(s, tr).find(x => x.team === side)?.outLabel ?? '—'
    rows.set(tr.id, row)
  })
  return [...rows.values()]
}

/** One Token per correct prediction; a pick on an unconfirmed match is held. */
export function pickScore(s: State, uid: string) {
  const mine = s.picks.filter(p => p.by === uid)
  let right = 0, held = 0
  mine.forEach(p => {
    const m = s.matches.find(x => x.id === p.match)
    if (!m || m.status !== 'confirmed') { held++; return }
    if (winnerId(m) === p.team) right++
  })
  return { total: mine.length, right, held, tokens: right }
}

/** The two columns every career table reads, named the way this sport names them. */
export const careerColumns = (sport: string) => {
  const L = statLabels(sport)
  return { g: L.g, a: L.a }
}
