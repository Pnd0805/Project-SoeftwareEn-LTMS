/**
 * src/shared/rules.ts
 *
 * The domain, ported from ltms-prototype.html. Pure functions only — every one
 * takes the state it reads, so a component can call them during render and a
 * test can call them with a fixture. Nothing here touches React or the DOM.
 */
import type {
  Format, Match, Pin, Registration, Rules, State, Team, Tournament, User,
} from './types'

/** The prototype pins "now" so the seeded season always reads the same way. */
export const NOW = () => new Date('2026-02-08T12:00:00').getTime()

/* ───────── constants ───────── */
export const SPORTS = ['Football', 'Futsal', 'Basketball', 'Volleyball', 'Badminton', 'VALORANT', 'ROV', 'Chess']
export const FACULTIES = ['Engineering', 'Science', 'Medicine', 'Law', 'Architecture', 'Nursing', 'Business Admin', 'Education']
export const MAJORS = ['General', 'Computer Engineering', 'Physics', 'Finance', 'Design', 'Public Health']

/** A squad names its sport when created and the minimum size follows from it. */
export const MIN_SQUAD = 3
const SPORT_MIN: Record<string, number> = {
  Football: 7, Futsal: 5, Basketball: 5, Volleyball: 6, Badminton: 2, VALORANT: 5, ROV: 5, Chess: 1,
}
export const minSquad = (t?: Team | null) => (t?.sport && SPORT_MIN[t.sport]) || MIN_SQUAD
export const teamReady = (t: Team) => t.members.length >= minSquad(t)

export const FORMATS: Record<Format, string> = {
  single: 'Single elimination',
  double: 'Double elimination',
  roundrobin: 'Round robin',
}
export const formatOf = (t?: Tournament | null): Format => (t && FORMATS[t.format] ? t.format : 'single')
export const formatName = (t?: Tournament | null) => FORMATS[formatOf(t)]

/** On-site needs two officials, online one. Asked here, never re-derived. */
export const refsNeeded = (t?: Tournament | null) => (t && t.channel === 'onsite' ? 2 : 1)

/* ───────── sport-aware statistics ───────── */
export interface SportStats {
  g: string | null
  a: string | null
  unit: string | null
  extra: [string, string][]
  team: [string, string, ('text' | 'num')?][]
}
const SPORT_STATS: Record<string, SportStats> = {
  Football: { g: 'Goals', a: 'Assists', unit: 'goal', extra: [['yellow', 'Yellow'], ['red', 'Red']], team: [] },
  Futsal: { g: 'Goals', a: 'Assists', unit: 'goal', extra: [['yellow', 'Yellow'], ['red', 'Red']], team: [] },
  Basketball: {
    g: 'Points', a: 'Assists', unit: 'point', extra: [['reb', 'Rebounds']],
    team: [['q1', 'Q1'], ['q2', 'Q2'], ['q3', 'Q3'], ['q4', 'Q4'], ['fouls', 'Fouls']],
  },
  Volleyball: { g: 'Points', a: 'Blocks', unit: 'point', extra: [], team: [['setpts', 'Points per set', 'text']] },
  Badminton: {
    g: 'Points', a: null, unit: 'point', extra: [],
    team: [['gamepts', 'Points per game', 'text'], ['deuce', 'Deuces'], ['rally', 'Rallies']],
  },
  VALORANT: {
    g: 'Kills', a: 'Assists', unit: 'kill',
    extra: [['deaths', 'Deaths'], ['fk', 'First kills'], ['plants', 'Plants'], ['defuses', 'Defuses']],
    team: [['mapsW', 'Maps won'], ['mapsL', 'Maps lost'], ['roundsW', 'Rounds won'], ['roundsL', 'Rounds lost']],
  },
  ROV: {
    g: 'Kills', a: 'Assists', unit: 'kill',
    extra: [['deaths', 'Deaths'], ['dmgOut', 'Damage dealt'], ['dmgIn', 'Damage taken']],
    team: [['gamesW', 'Games won'], ['gamesL', 'Games lost']],
  },
  Chess: { g: null, a: null, unit: null, extra: [], team: [] },
}
const GENERIC_STATS: SportStats = { g: 'Scored', a: 'Assists', unit: 'point', extra: [], team: [] }
export const statLabels = (sport: string): SportStats => SPORT_STATS[sport] || GENERIC_STATS
export const statExtra = (sport: string) => statLabels(sport).extra
export const statTeam = (sport: string) => statLabels(sport).team

/** What a scoreline counts — a volleyball 3–1 is sets, not points. */
const SCORE_UNIT: Record<string, string> = {
  Football: 'Goals', Futsal: 'Goals', Basketball: 'Points', Volleyball: 'Sets',
  Badminton: 'Games', VALORANT: 'Maps', ROV: 'Games', Chess: 'Result',
}
export const scoreUnit = (sport: string) => SCORE_UNIT[sport] || 'Points'

/** And what settles it when the scoreline is level. */
const DECIDER: Record<string, string> = {
  Football: 'Penalties', Futsal: 'Penalties', Basketball: 'Overtime', Volleyball: 'Tiebreak',
  Badminton: 'Tiebreak', VALORANT: 'Overtime', ROV: 'Overtime', Chess: 'Armageddon',
}
export const deciderName = (sport: string) => DECIDER[sport] || 'Decider'

/* ───────── time and place ───────── */
export function ago(at: number | string, now = NOW()): string {
  const t = typeof at === 'number' ? at : new Date(at).getTime()
  const d = Math.round((now - t) / 1000)
  if (!isFinite(d)) return ''
  if (d < 0) return 'in ' + ago(now * 2 - t, now)
  if (d < 60) return 'just now'
  if (d < 3600) return Math.floor(d / 60) + ' min ago'
  if (d < 86400) return Math.floor(d / 3600) + 'h ago'
  if (d < 2592000) return Math.floor(d / 86400) + 'd ago'
  return Math.floor(d / 2592000) + 'mo ago'
}
export function fmtDate(iso: number | string): string {
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? 'Not set'
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** A pin is taken the way a person has it — a Maps link, or a bare "lat, lng". */
export function parsePin(text: string): Pin | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const hit = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    || raw.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    || raw.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!hit) return null
  const lat = Number(hit[1]), lng = Number(hit[2])
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}
export const pinHref = (pin: Pin) => `https://www.google.com/maps?q=${pin.lat},${pin.lng}`
export const pinText = (pin?: Pin | null) => (pin ? `${pin.lat}, ${pin.lng}` : '')


/* ───────── the Hard filter ───────── */
export const ageOf = (dob: string) => {
  const d = new Date(dob), n = new Date('2026-02-08')
  let a = n.getFullYear() - d.getFullYear()
  const m = n.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--
  return a
}
const ageLimit = (v: number | 'any'): number | null => (v === 'any' || v === null || v === undefined ? null : Number(v))

export interface Fail { user: User; rule: string; need: string | number; got: string | number }

/** A player already entered in this tournament with another squad. */
export function doubleEntered(s: State, tm: Team, tr: Tournament, ids: string[]) {
  const out: { user: User; other: Team }[] = []
  const others = s.registrations.filter(r => r.tour === tr.id && r.team !== tm.id
    && (r.status === 'approved' || r.status === 'pending'))
  ids.forEach(id => {
    const clash = others.find(r => {
      const ot = s.teams.find(x => x.id === r.team)
      return !!ot && (r.squad.length ? r.squad : ot.members).includes(id)
    })
    const u = s.users.find(x => x.id === id)
    const ot = clash && s.teams.find(x => x.id === clash.team)
    if (u && ot) out.push({ user: u, other: ot })
  })
  return out
}

/**
 * Every Player on the Squad list against the Tournament's entry conditions.
 * An unset condition admits everybody — it is not a condition that always fails.
 * Failing rejects the registration outright; no Organizer can override it.
 */
export function hardFilter(s: State, tm: Team, tr: Tournament, ids?: string[]): Fail[] {
  const fails: Fail[] = []
  const entering = (ids && ids.length ? ids : tm.members).filter(id => tm.members.includes(id))
  doubleEntered(s, tm, tr, entering).forEach(c =>
    fails.push({ user: c.user, rule: 'Already entered', need: 'one squad per tournament', got: c.other.name }))
  for (const id of entering) {
    const u = s.users.find(x => x.id === id)
    if (!u) continue
    const r = tr.rules, age = ageOf(u.dob)
    const lo = ageLimit(r.ageMin), hi = ageLimit(r.ageMax)
    const band = `${lo === null ? 'any' : lo}–${hi === null ? 'any' : hi}`
    if (r.gender !== 'any' && u.gender !== r.gender) fails.push({ user: u, rule: 'Gender', need: r.gender, got: u.gender })
    if (lo !== null && age < lo) fails.push({ user: u, rule: 'Age', need: band, got: age })
    else if (hi !== null && age > hi) fails.push({ user: u, rule: 'Age', need: band, got: age })
    if (r.faculty !== 'any' && u.faculty !== r.faculty) fails.push({ user: u, rule: 'Faculty', need: r.faculty, got: u.faculty })
    if (r.major && r.major !== 'any' && u.major !== r.major) fails.push({ user: u, rule: 'Major', need: r.major, got: u.major })
    if (r.year !== 'any' && String(u.year) !== String(r.year)) fails.push({ user: u, rule: 'Year', need: String(r.year), got: u.year })
  }
  return fails
}

/** The entry conditions as one line. Empty means open to everybody. */
export function ruleSummary(r: Partial<Rules>): string {
  const bits: string[] = []
  if (r.gender && r.gender !== 'any') bits.push(r.gender)
  const lo = r.ageMin === undefined ? null : ageLimit(r.ageMin)
  const hi = r.ageMax === undefined ? null : ageLimit(r.ageMax)
  if (lo !== null || hi !== null) bits.push(`age ${lo ?? 'any'}–${hi ?? 'any'}`)
  if (r.faculty && r.faculty !== 'any') bits.push(r.faculty)
  if (r.major && r.major !== 'any') bits.push(r.major)
  if (r.year && r.year !== 'any') bits.push(`year ${r.year}`)
  return bits.join(' · ')
}

/* ───────── rounds and stages ───────── */
export const roundName = (round: number, rounds: number) => {
  const left = 1 << (rounds - round)
  return left === 2 ? 'Final' : left === 4 ? 'Semi-final' : left === 8 ? 'Quarter-final' : `Round of ${left}`
}
export const shortRound = (round: number, rounds: number) => {
  const left = 1 << (rounds - round)
  return left === 2 ? 'F' : left === 4 ? 'SF' : left === 8 ? 'QF' : 'R' + left
}
export const matchStage = (s: State, m: Match) =>
  m.stage || roundName(m.round, s.tournaments.find(t => t.id === m.tour)?.rounds || 0)
export const matchTag = (s: State, m: Match) =>
  m.tag || shortRound(m.round, s.tournaments.find(t => t.id === m.tour)?.rounds || 0) + (m.slot + 1)

/* ───────── the draw ───────── */
export function seedOrder(ids: string[]) {
  const size = 1 << Math.ceil(Math.log2(Math.max(2, ids.length)))
  return { size, slots: [...ids, ...Array(Math.max(0, size - ids.length)).fill(null)] as (string | null)[] }
}

type MkOpts = Partial<Match> & { round: number; slot: number }
export function mkMatch(tr: Tournament, o: MkOpts, id: string): Match {
  return {
    id, tour: tr.id, round: o.round, slot: o.slot,
    bracket: o.bracket || 'W', stage: o.stage, tag: o.tag, depth: o.depth === undefined ? o.round : o.depth,
    a: o.a || null, b: o.b || null, sa: null, sb: null, status: 'scheduled', channel: tr.channel,
    enteredBy: null, confirmedBy: null, disputedBy: null, disputedTeam: null, note: '',
    kickoff: '', venue: '', pin: null, refs: (tr.referees || []).slice(0, refsNeeded(tr)),
    checkedIn: [], stats: {}, teamStats: {}, lineup: {}, winTo: null, loseTo: null,
  }
}

/**
 * Byes are spread by pairing slot i against size-1-i. Filling sequentially lets
 * empty slots pair with each other, producing a match that can never resolve.
 */
/* ───────── results ───────── */
/**
 * Level with no Decider is a Level result — it stands in round robin, and the
 * entry form refuses it anywhere else, so null here means "finished level".
 */
export const winnerId = (m?: Match | null): string | null => {
  if (!m || !m.a || !m.b) return (m && (m.a || m.b)) || null
  if (m.sa === m.sb) return m.decider ? (m.decider.a > m.decider.b ? m.a : m.b) : null
  return (m.sa ?? 0) > (m.sb ?? 0) ? m.a : m.b
}
export const wonBy = (m: Match, tid: string | null) => !!tid && winnerId(m) === tid
export const winnerOf = (m: Match) => (m.status === 'confirmed' ? winnerId(m) : null)
export const nextOf = (s: State, m: Match): Match | undefined =>
  m.winTo
    ? s.matches.find(x => x.id === m.winTo!.m)
    : s.matches.find(x => x.tour === m.tour && x.round === m.round + 1 && x.slot === (m.slot >> 1))

/** Until the first match starts, the organizer may keep rearranging the draw. */
export function drawStarted(s: State, tr: Tournament) {
  return s.matches.filter(m => m.tour === tr.id).some(m =>
    m.checkedIn.length
    || (m.status !== 'scheduled' && m.note !== 'bye' && m.note !== 'void')
    || (!!m.kickoff && new Date(m.kickoff).getTime() <= NOW()))
}


/**
 * A Leader names a Lineup per match; until they do it is the Squad list they
 * registered, and until that exists it is the whole Team. Paperwork never blocks.
 */
export function lineupOf(s: State, m: Match, tid: string | null): string[] {
  const tm = s.teams.find(t => t.id === tid)
  if (!tm) return []
  const named = (m.lineup || {})[tm.id]
  if (named?.starters?.length) return [...named.starters, ...(named.subs || [])]
  const reg = s.registrations.find(r => r.tour === m.tour && r.team === tm.id && r.status === 'approved')
  const squad = reg?.squad?.length ? reg.squad.filter(id => tm.members.includes(id)) : null
  return squad?.length ? squad : tm.members
}

/* ───────── the leaderboard, derived and never stored ───────── */
export interface BoardRow {
  team: string; p: number; w: number; d: number; l: number
  gf: number; ga: number; gd: number; pts: number; mini: number
  out: number | null; outStage?: string | null; outLabel: string
  form: string[]; rank: number; depth?: number
}

/** Round robin: 3 / 1 / 0, separated by difference, then units scored, then the mini-table. */
export function standings(s: State, tr: Tournament): BoardRow[] {
  const rows = new Map<string, BoardRow>()
  const touch = (id: string | null) => {
    if (!id) return undefined
    if (!rows.has(id)) rows.set(id, { team: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, mini: 0, out: null, outLabel: '', form: [], rank: 0 })
    return rows.get(id)!
  }
  s.registrations.filter(r => r.tour === tr.id && r.status === 'approved').forEach(r => touch(r.team))
  const played = s.matches.filter(m => m.tour === tr.id && m.status === 'confirmed' && m.note !== 'bye' && m.a && m.b)
  played.forEach(m => {
    const A = touch(m.a), B = touch(m.b)
    if (!A || !B) return
    A.p++; B.p++
    A.gf += m.sa ?? 0; A.ga += m.sb ?? 0; B.gf += m.sb ?? 0; B.ga += m.sa ?? 0
    const win = winnerId(m)
    if (!win) { A.d++; B.d++; A.pts++; B.pts++; A.form.push('D'); B.form.push('D') }
    else {
      const Wr = win === m.a ? A : B, Lr = win === m.a ? B : A
      Wr.w++; Wr.pts += 3; Wr.form.push('W'); Lr.l++; Lr.form.push('L')
    }
  })
  const list = [...rows.values()]
  list.forEach(r => { r.gd = r.gf - r.ga })
  const key = (r: BoardRow) => [r.pts, r.gd, r.gf].join('|')
  const groups = new Map<string, BoardRow[]>()
  list.forEach(r => { const k = key(r); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r) })
  groups.forEach(g => {
    if (g.length < 2) return
    const inGroup = new Set(g.map(r => r.team)), row = (id: string | null) => g.find(r => r.team === id)
    played.filter(m => inGroup.has(m.a!) && inGroup.has(m.b!)).forEach(m => {
      const win = winnerId(m)
      if (!win) { row(m.a)!.mini++; row(m.b)!.mini++ } else row(win)!.mini += 3
    })
  })
  list.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.mini - a.mini || a.team.localeCompare(b.team))
  let rank = 0, prev: string | null = null, seen = 0
  list.forEach(r => {
    seen++
    const k = [r.pts, r.gd, r.gf, r.mini].join('|')
    if (k !== prev) { rank = seen; prev = k }
    r.rank = rank
    r.outLabel = tr.champion === r.team ? 'Champion' : `${r.pts} point${r.pts === 1 ? '' : 's'}`
  })
  return list
}

/**
 * Single elimination: the round you went out in. Double: the round of your second
 * loss. Round robin: the table. Teams level share a rank in all three.
 */
export function leaderboard(s: State, tr: Tournament): BoardRow[] {
  if (formatOf(tr) === 'roundrobin') return standings(s, tr)
  const ms = s.matches.filter(m => m.tour === tr.id)
  const rounds = tr.rounds || 0, twice = formatOf(tr) === 'double'
  const rows = new Map<string, BoardRow>()
  const touch = (id: string | null) => {
    if (!id) return undefined
    if (!rows.has(id)) rows.set(id, { team: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, mini: 0, out: null, outStage: null, outLabel: '', form: [], rank: 0 })
    return rows.get(id)!
  }
  ms.filter(m => m.status === 'confirmed' && m.note !== 'bye').forEach(m => {
    const A = touch(m.a), B = touch(m.b)
    if (!A || !B) return
    A.p++; B.p++
    const aw = wonBy(m, m.a)
    ;(aw ? A : B).w++; (aw ? A : B).form.push('W'); (aw ? B : A).form.push('L')
    const loser = aw ? B : A
    loser.l++
    if (!twice || loser.l >= 2) { loser.out = m.depth === undefined ? m.round : m.depth; loser.outStage = m.stage || null }
  })
  s.registrations.filter(r => r.tour === tr.id && r.status === 'approved').forEach(r => touch(r.team))
  const list = [...rows.values()]
  list.forEach(r => { r.depth = r.out === null ? 99 : r.out })
  list.sort((a, b) => (b.depth! - a.depth!) || b.w - a.w)
  let rank = 0, prev: number | null = null, seen = 0
  list.forEach(r => {
    seen++
    if (r.depth !== prev) { rank = seen; prev = r.depth! }
    r.rank = rank
    r.outLabel = r.out === null
      ? (tr.champion === r.team ? 'Champion' : 'Still in')
      : (r.outStage || roundName(r.out, rounds))
  })
  return list
}

/** The team's most-advanced appearance — the bracket row a confirm morphs into. */
export function bracketFrontier(s: State, trId: string) {
  const tr = s.tournaments.find(t => t.id === trId)
  const best = new Map<string, { round: number; matchId: string }>()
  if (!tr || formatOf(tr) === 'roundrobin') return best
  s.matches.filter(m => m.tour === trId).forEach(m => [m.a, m.b].forEach(tid => {
    if (!tid) return
    const cur = best.get(tid)
    if (!cur || m.round > cur.round) best.set(tid, { round: m.round, matchId: m.id })
  }))
  return best
}

/** Registration is closed once the window has passed, whatever else is true. */
export function regWindowClosed(tr: Tournament): string {
  const start = new Date(tr.date + 'T00:00:00').getTime()
  return isFinite(start) && start <= NOW() ? 'The tournament has started — entries are closed.' : ''
}

/** finished / competing / open — a private or pending tournament has no lifecycle yet. */
export const tourLifecycle = (t: Tournament) =>
  t.champion ? 'finished' : t.drawn ? 'competing' : t.status === 'public' ? 'open' : 'other'

/** A registration that would put this squad in the draw. */
export const approvedRegs = (s: State, trId: string): Registration[] =>
  s.registrations.filter(r => r.tour === trId && r.status === 'approved')
