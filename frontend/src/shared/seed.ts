/**
 * src/shared/seed.ts
 *
 * A season that already happened — the fixture set the ported UI renders until a
 * backend exists (PLAN.md phase 1). Deterministic: one PRNG seed, so the demo is
 * identical on every machine and a bug report is reproducible.
 *
 * Condensed from the prototype's 500-line generator: the same *states*, a tenth
 * of the population. Between them the tournaments below cover every state the
 * SRS describes — pending approval, private and short of referees, open for
 * entry, mid-bracket with a live dispute, a round robin part-played, and one
 * finished with a champion and MVP votes — across six sports, onsite and online.
 */
import { buildBracket, NOW, refsNeeded, statLabels, winnerId } from './rules'
import type {
  Match, Pin, Registration, Rules, State, Team, Tournament, User,
} from './types'

const DAY = 86400000
const daysAgo = (d: number) => NOW() - d * DAY
const atDay = (d: number, hour = 14) =>
  new Date(NOW() + d * DAY - (12 - hour) * 3600000).toISOString()

const FIRST = ['Anan', 'Busaba', 'Chaiwat', 'Duangporn', 'Ekkarat', 'Fonthip', 'Gorn', 'Hathai', 'Itthipol',
  'Jiraporn', 'Kraisorn', 'Lalita', 'Manop', 'Napat', 'Orawan', 'Pipat', 'Ratana', 'Somsak', 'Thidarat',
  'Uthai', 'Veera', 'Wanida', 'Yuttana', 'Chomphu', 'Sarawut', 'Praewa', 'Nattapong', 'Malee', 'Kitti', 'Sudarat']
const LAST = ['Suwan', 'Prasert', 'Chaicharoen', 'Thongdee', 'Sae-Lim', 'Boonrueang', 'Wattana', 'Rojjana']
const FACS = ['Engineering', 'Science', 'Medicine', 'Law', 'Architecture', 'Nursing', 'Business Admin', 'Education']
const MAJS = ['General', 'Computer Engineering', 'Physics', 'Finance', 'Design', 'Public Health']

const VENUE_PIN: Record<string, Pin> = {
  'Main Stadium': { lat: 13.736717, lng: 100.523186 },
  'Gymnasium A': { lat: 13.738201, lng: 100.5249 },
  'Gymnasium B': { lat: 13.73945, lng: 100.52601 },
  'Indoor Court 1': { lat: 13.73511, lng: 100.52174 },
  'Student Union Hall': { lat: 13.73799, lng: 100.51988 },
  'Computer Lab 4': { lat: 13.74021, lng: 100.5224 },
}

/** plausible ranges — a basketball game is not 3–1, a football match is not 71–64 */
const SPORT_SCORE: Record<string, [number, number]> = {
  Football: [0, 5], Futsal: [1, 8], Basketball: [54, 96], Volleyball: [0, 3],
  Badminton: [0, 2], VALORANT: [4, 13], ROV: [4, 13], Chess: [0, 1],
}

export function SEED(): State {
  let _s = 20260209
  const R = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296 }
  const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1))
  const shuffle = <T,>(a: T[]) => {
    const x = a.slice()
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [x[i], x[j]] = [x[j], x[i]] }
    return x
  }

  let n = 0
  const nid = (p: string) => `${p}-${++n}`

  const S: State = {
    seq: 0, session: null, users: [], teams: [], tournaments: [], registrations: [], matches: [],
    invites: [], refInvites: [], announcements: [], notifications: [], picks: [], votes: [],
    follows: [], comments: [], feedback: [], permanentRequests: [],
  }

  /* ── the five accounts the login screen offers ── */
  const U = (id: string, name: string, email: string, role: User['role'], x: Partial<User> = {}) => {
    S.users.push({ id, name, email, role, gender: 'Male', dob: '2004-03-14', faculty: 'Engineering', major: 'General', year: 3, ...x })
    return id
  }
  U('u-admin', 'Rattana Admin', 'admin@ltms.test', 'Admin', { faculty: 'Registry', major: '—', year: 0, gender: 'Female' })
  U('u-org', 'Thanwa Sirichai', 'organizer@ltms.test', 'User', { faculty: 'Engineering', year: 4 })
  U('u-ref', 'Kittipong Rojana', 'referee@ltms.test', 'User', { faculty: 'Science', year: 4 })
  U('u-lead', 'Sirawit Kanchana', 'leader@ltms.test', 'User', { faculty: 'Engineering', major: 'Computer Engineering', year: 3 })
  /* fails the 18–25 age rule on purpose — the hard filter needs something to catch */
  U('u-play', 'Mongkol Thanit', 'player@ltms.test', 'User', { dob: '2009-06-02', faculty: 'Engineering', year: 1 })

  /* a bench of officials, so an on-site match can always field two */
  const officials = ['u-ref']
  ;['Nattapong Suk', 'Achara Pimchan', 'Weerapong Ton', 'Suchada Kaew'].forEach((nm, i) => {
    officials.push(U('u-ref' + (i + 2), nm, `ref${i + 2}@ltms.test`, 'User', { faculty: FACS[i % FACS.length], year: 4 }))
  })

  /* a population, then squads carved from it so no roster ever overlaps */
  const pool: string[] = []
  for (let i = 0; i < 84; i++) {
    pool.push(U(nid('u'), `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`, `p${i}@ltms.test`, 'User', {
      gender: i % 3 === 0 ? 'Female' : 'Male',
      dob: `${2002 + (i % 6)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      faculty: FACS[i % FACS.length],
      major: MAJS[i % MAJS.length],
      year: (i % 4) + 1,
    }))
  }
  let cursor = 0
  const take = (k: number) => pool.slice(cursor, (cursor += k))

  const T = (id: string, name: string, code: string, color: string, leader: string, members: string[], x: Partial<Team> = {}) => {
    S.teams.push({ id, name, code, color, leader, members, created: daysAgo(180), disabled: false, permanent: false, ...x })
    return id
  }
  const CLUBS: [string, string, string, string, string][] = [
    ['t-eng', 'Engineering', 'ENG', '#E8402A', 'Football'],
    ['t-sci', 'Science', 'SCI', '#2D9CDB', 'Football'],
    ['t-med', 'Medicine', 'MED', '#27AE60', 'Football'],
    ['t-law', 'Law', 'LAW', '#4A6CF7', 'Football'],
    ['t-arc', 'Architecture', 'ARC', '#F2994A', 'Football'],
    ['t-nur', 'Nursing', 'NUR', '#56CCF2', 'Volleyball'],
    ['t-bus', 'Business Admin', 'BUS', '#F2B705', 'Volleyball'],
    ['t-edu', 'Education', 'EDU', '#5E6BC4', 'Volleyball'],
  ]
  CLUBS.forEach(([id, name, code, color, sport], i) => {
    const roster = take(7)
    T(id, name, code, color, roster[0], roster, { permanent: i < 4, created: daysAgo(300 + i * 5), sport })
  })

  /* Byte Force is the squad the demo drives, so its ages are pinned: everyone
     clears the 18–25 rule except Mongkol, who is the point of the example. */
  const bytMates = ['Chalermchai Ponsri', 'Nalin Pattama', 'Kanya Duangjai', 'Peerapat Nont'].map((nm, i) =>
    U(nid('u'), nm, `byt${i}@ltms.test`, 'User',
      { gender: i === 1 ? 'Female' : 'Male', dob: `2004-0${i + 2}-12`, faculty: 'Engineering', year: 3 }))
  T('t-byt', 'Byte Force', 'BYT', '#FF4655', 'u-lead', ['u-lead', 'u-play', ...bytMates], { created: daysAgo(11), sport: 'VALORANT' })
  T('t-cir', 'Circuit Breakers', 'CIR', '#19E3C0', pool[cursor], take(5), { created: daysAgo(120), sport: 'VALORANT' })
  T('t-spk', 'Spikers United', 'SPK', '#FFB020', pool[cursor], take(6), { created: daysAgo(140), sport: 'Volleyball' })
  T('t-sht', 'Shuttle Squad', 'SHT', '#B07CE8', pool[cursor], [...take(4), 'u-ref'], { created: daysAgo(95), sport: 'Futsal' })
  T('t-rgu', 'Rogue Unit', 'RGU', '#7E57C2', pool[cursor], take(5), { created: daysAgo(70), sport: 'VALORANT' })
  T('t-nqx', 'Nexus Five', 'NQX', '#42A5F5', pool[cursor], take(5), { created: daysAgo(64), sport: 'VALORANT' })
  T('t-tit', 'Titans', 'TIT', '#FF7043', pool[cursor], take(6), { created: daysAgo(210), sport: 'Basketball' })
  T('t-hrn', 'Hornets', 'HRN', '#FFCA28', pool[cursor], take(6), { created: daysAgo(205), sport: 'Basketball' })
  /* a squad that never entered anything — the fortnight sweep will disable it */
  T('t-gho', 'Ghost Nine', 'GHO', '#78909C', pool[cursor], take(3), { created: daysAgo(40), sport: 'Futsal' })
  /* still Forming: below the minimum for its sport, so it cannot register */
  T('t-haf', 'Half Team', 'HAF', '#90A4AE', pool[cursor], take(2), { created: daysAgo(4), sport: 'Futsal' })

  const rules = (x: Partial<Rules> = {}): Rules =>
    ({ gender: 'any', ageMin: 17, ageMax: 28, faculty: 'any', major: 'any', year: 'any', ...x })

  const TR = (o: Partial<Tournament> & Pick<Tournament, 'id' | 'name' | 'sport' | 'organizer' | 'venue' | 'date' | 'cap'>): Tournament => {
    const t: Tournament = {
      format: 'single', channel: 'onsite', status: 'public', drawn: false, champion: null, rounds: 0,
      referees: [], rules: rules(), pin: VENUE_PIN[o.venue] || null, ...o,
    } as Tournament
    S.tournaments.push(t)
    return t
  }

  const REG = (tr: Tournament, teamId: string, status: Registration['status'], x: Partial<Registration> = {}) => {
    const tm = S.teams.find(t => t.id === teamId)!
    S.registrations.push({ id: nid('r'), tour: tr.id, team: teamId, status, at: daysAgo(30), squad: tm.members.slice(), ...x })
  }

  /* ── 1 · the cup in progress, with a live dispute ── */
  const football = TR({
    id: 't-fb', name: 'Faculty Football Cup 2026', sport: 'Football', format: 'single', channel: 'onsite',
    status: 'public', organizer: 'u-org', venue: 'Main Stadium', date: '2026-02-14', cap: 8,
    referees: ['u-ref', 'u-ref2'], rules: rules({ ageMin: 18, ageMax: 25 }),
    entryNotes: 'Bring your own kit in two colours. Studs checked at the table 30 minutes before kick-off. Anyone late for the check-in table forfeits the toss, not the match.',
  })
  const fbTeams = ['t-eng', 't-sci', 't-med', 't-law', 't-arc', 't-nur', 't-bus', 't-edu']
  fbTeams.forEach(id => REG(football, id, 'approved'))

  /* ── 2 · an online league that finished, champion crowned ── */
  const valorant = TR({
    id: 't-vlr', name: 'VALORANT Campus League 2025', sport: 'VALORANT', format: 'single', channel: 'online',
    status: 'public', organizer: 'u-org', venue: 'Computer Lab 4', date: '2025-12-06', cap: 8,
    referees: ['u-ref3'], rules: rules({ ageMin: 'any', ageMax: 'any' }),
  })
  const vlrTeams = ['t-byt', 't-cir', 't-rgu', 't-nqx']
  vlrTeams.forEach(id => REG(valorant, id, 'approved', { at: daysAgo(90) }))

  /* ── 3 · open for entry: two waiting on the organizer, one the filter refused ── */
  const futsal = TR({
    id: 't-fut', name: 'Inter-Faculty Futsal 2026', sport: 'Futsal', format: 'single', channel: 'onsite',
    status: 'public', organizer: 'u-org', venue: 'Indoor Court 1', date: '2026-03-08', cap: 16,
    referees: ['u-ref', 'u-ref4'], rules: rules({ ageMin: 18, ageMax: 25 }),
    entryNotes: 'Shin pads are not optional. One squad per faculty; if two of you enter under the same name the second is refused.',
  })
  REG(futsal, 't-eng', 'approved'); REG(futsal, 't-sci', 'approved'); REG(futsal, 't-med', 'approved')
  REG(futsal, 't-sht', 'pending', { at: daysAgo(2) })
  REG(futsal, 't-cir', 'pending', { at: daysAgo(1) })
  REG(futsal, 't-tit', 'rejected', { at: daysAgo(5), reason: '2 players failed Age (18–25)' })

  /* ── 4 · private, one referee short, so it cannot be published ── */
  const basketball = TR({
    id: 't-bkb', name: 'Faculty Basketball Showdown', sport: 'Basketball', format: 'double', channel: 'onsite',
    status: 'private', organizer: 'u-org', venue: 'Gymnasium A', date: '2026-03-14', cap: 8,
    referees: ['u-ref5'], rules: rules({ ageMin: 'any', ageMax: 'any', faculty: 'any' }),
  })
  ;['t-tit', 't-hrn', 't-eng', 't-sci'].forEach(id => REG(basketball, id, 'approved'))

  /* ── 5 · a round robin part-played: a table, not a tree ── */
  const volley = TR({
    id: 't-vb', name: 'Engineering Volleyball Cup', sport: 'Volleyball', format: 'roundrobin', channel: 'onsite',
    status: 'public', organizer: 'u-org', venue: 'Gymnasium B', date: '2026-03-01', cap: 8,
    referees: ['u-ref', 'u-ref2'], rules: rules({ ageMin: 17, ageMax: 30 }),
  })
  ;['t-nur', 't-bus', 't-edu', 't-spk'].forEach(id => REG(volley, id, 'approved'))

  /* ── 6 · a request an admin has not answered ── */
  const chess = TR({
    id: 't-chs', name: 'Campus Chess Ladder', sport: 'Chess', format: 'roundrobin', channel: 'online',
    status: 'pending', organizer: 'u-lead', venue: 'Student Union Hall', date: '2026-04-02', cap: 12,
    rules: rules({ ageMin: 'any', ageMax: 'any' }),
  })
  REG(chess, 't-byt', 'pending', { at: daysAgo(3) })

  /* ── draw and play ─────────────────────────────────────────────────
     The same builders the running app calls, so a seeded bracket and a bracket
     drawn in the UI are the same object with the same wiring. */
  const draw = (tr: Tournament, drawnDaysAgo: number) => {
    const ids = shuffle(S.registrations.filter(r => r.tour === tr.id && r.status === 'approved').map(r => r.team))
    const made = buildBracket(tr, ids, () => nid('m'))
    tr.drawn = true
    tr.drawnAt = daysAgo(drawnDaysAgo)
    made.forEach((m, i) => {
      m.venue = tr.venue
      m.pin = tr.pin
      m.refs = (tr.referees || []).slice(0, refsNeeded(tr))
      m.kickoff = atDay(-drawnDaysAgo + m.round * 2 + Math.floor(i / 4))
    })
    S.matches.push(...made)
    return made
  }

  const put = (m: Match, side: 'a' | 'b', tid: string | null) => { if (tid) m[side] = tid }
  /** Where a result goes next — the same winTo/loseTo graph the running app walks. */
  const advance = (tr: Tournament, m: Match) => {
    const win = winnerId(m)
    const lose = win ? [m.a, m.b].find(x => x && x !== win) ?? null : null
    if (m.winTo) { const nx = S.matches.find(x => x.id === m.winTo!.m); if (nx) put(nx, m.winTo.side, win) }
    else if (win && m.bracket !== 'RR') tr.champion = win
    if (m.loseTo) { const nx = S.matches.find(x => x.id === m.loseTo!.m); if (nx) put(nx, m.loseTo.side, lose) }
  }
  const leaderOf = (tid: string | null) => S.teams.find(t => t.id === tid)?.leader ?? 'u-lead'

  /**
   * Record a result the way the channel says it happens (OF-03): on-site the
   * referees record and the winning leader signs off; online the winning leader
   * submits and the referee confirms.
   */
  const record = (tr: Tournament, m: Match) => {
    const [lo, hi] = SPORT_SCORE[tr.sport] || [0, 5]
    let sa = int(lo, hi), sb = int(lo, hi)
    if (sa === sb) sb = sa > lo ? sa - 1 : sa + 1        // no confirmed draw in a knockout
    m.sa = sa; m.sb = sb
    m.status = 'confirmed'
    const winLeader = leaderOf(winnerId(m))
    const official = (tr.referees || [])[0] ?? 'u-ref'
    m.enteredBy = tr.channel === 'onsite' ? official : winLeader
    m.confirmedBy = tr.channel === 'onsite' ? winLeader : official
    m.checkedIn = [m.a, m.b].filter(Boolean).flatMap(tid => S.teams.find(t => t.id === tid)!.members)
    const L = statLabels(tr.sport)
    if (L.g) {
      ;[[m.a, sa], [m.b, sb]].forEach(([tid, score]) => {
        const tm = S.teams.find(t => t.id === tid)
        if (!tm) return
        let left = score as number
        tm.members.forEach((pid, i) => {
          const g = i === tm.members.length - 1 ? left : Math.min(left, int(0, 1))
          left -= g
          if (g || i < 2) m.stats[pid] = { team: tm.id, goals: g, assists: int(0, 1), x: {} }
        })
      })
    }
    advance(tr, m)
  }

  /** An empty slot is settled without anybody doing anything. */
  const resolveByes = (tr: Tournament) => {
    S.matches.filter(m => m.tour === tr.id && m.round === 0 && !!m.a !== !!m.b).forEach(m => {
      m.status = 'confirmed'
      m.note = 'bye'
      m.sa = m.a ? 1 : 0
      m.sb = m.b ? 1 : 0
      advance(tr, m)
    })
  }

  /* the football cup: first round played, one semi disputed, one still to record */
  const fbMatches = draw(football, 30)
  resolveByes(football)
  fbMatches.filter(m => m.round === 0 && m.status === 'scheduled').forEach(m => record(football, m))
  const semis = S.matches.filter(m => m.tour === football.id && m.round === 1)
  if (semis[0]) {
    const m = semis[0]
    m.sa = 2; m.sb = 1; m.status = 'disputed'
    m.enteredBy = 'u-ref'
    m.disputedBy = S.teams.find(t => t.id === m.b)!.leader
    m.disputedTeam = m.b
    m.checkedIn = [m.a, m.b].filter(Boolean).flatMap(tid => S.teams.find(t => t.id === tid)!.members)
  }
  if (semis[1]) {
    const m = semis[1]
    m.sa = 3; m.sb = 2; m.status = 'pending'
    m.enteredBy = 'u-ref'
    m.checkedIn = [m.a, m.b].filter(Boolean).flatMap(tid => S.teams.find(t => t.id === tid)!.members)
  }

  /* the VALORANT league: played to the end, champion crowned */
  const vlrMatches = draw(valorant, 80)
  resolveByes(valorant)
  vlrMatches.slice().sort((a, b) => a.round - b.round).forEach(m => {
    if (!m.a || !m.b || m.status === 'confirmed') return
    record(valorant, m)
  })
  const vlrFinal = S.matches.filter(m => m.tour === valorant.id).sort((a, b) => b.round - a.round)[0]
  valorant.champion = winnerId(vlrFinal)
  valorant.rounds = Math.max(...S.matches.filter(m => m.tour === valorant.id).map(m => m.round)) + 1

  /* the volleyball round robin: two matchdays in, the rest to come */
  const vbMatches = draw(volley, 12)
  vbMatches.filter(m => m.round < 2 && m.a && m.b).forEach(m => record(volley, m))

  /* ── invitations in each state ── */
  S.invites.push({ id: nid('i'), team: 't-byt', user: pool[0], status: 'pending' })
  S.invites.push({ id: nid('i'), team: 't-cir', user: 'u-play', status: 'pending' })
  S.invites.push({ id: nid('i'), team: 't-spk', user: pool[1], status: 'accepted' })

  /* ── referee appointments: accepted, still open, declined ── */
  S.refInvites.push({ id: nid('ri'), tour: football.id, user: 'u-ref', status: 'accepted' })
  S.refInvites.push({ id: nid('ri'), tour: football.id, user: 'u-ref2', status: 'accepted' })
  S.refInvites.push({ id: nid('ri'), tour: basketball.id, user: 'u-ref', status: 'pending' })
  S.refInvites.push({ id: nid('ri'), tour: basketball.id, user: 'u-ref4', status: 'declined' })
  S.refInvites.push({ id: nid('ri'), tour: futsal.id, user: 'u-ref', status: 'accepted' })

  /* ── announcements ── */
  S.announcements.push({
    id: nid('a'), tour: football.id, by: 'u-org', at: daysAgo(4),
    title: 'Saturday kick-offs move 30 minutes later',
    body: 'The pitch is being re-lined on Saturday morning. Every Saturday fixture shifts 30 minutes back; weekday kick-offs are unchanged.',
  })
  S.announcements.push({
    id: nid('a'), tour: football.id, by: 'u-org', at: daysAgo(18),
    title: 'Check-in opens 45 minutes before kick-off',
    body: 'Bring a student card. The QR at the table rolls every minute, so scan it when you are actually there.',
  })

  /* ── notifications for the accounts a reviewer will sign into ── */
  const notify = (to: string, text: string, href: string, at: number, read = false) =>
    S.notifications.push({ id: nid('n'), to, text, href, at, read })
  notify('u-org', 'Shuttle Squad registered for Inter-Faculty Futsal 2026.', '/t/t-fut/manage/registrations', daysAgo(2))
  notify('u-org', 'A result in Faculty Football Cup 2026 was disputed.', `/m/${semis[0]?.id ?? ''}`, daysAgo(1))
  notify('u-ref', 'You were appointed to officiate Faculty Basketball Showdown.', '/matches', daysAgo(3))
  notify('u-lead', 'Your request to organize Campus Chess Ladder is with an admin.', '/t/t-chs', daysAgo(3), true)
  notify('u-play', 'Circuit Breakers invited you to join the squad.', '/teams', daysAgo(1))
  notify('u-admin', 'Campus Chess Ladder is waiting on your approval.', '/admin', daysAgo(3))

  /* ── Pick'em on what is still to play, MVP votes on what is done ── */
  S.matches.filter(m => m.tour === football.id && m.status === 'scheduled' && m.a && m.b).slice(0, 2)
    .forEach(m => S.picks.push({ id: nid('p'), match: m.id, by: 'u-lead', team: m.a! }))
  const vlrChampMembers = S.teams.find(t => t.id === valorant.champion)?.members ?? []
  if (vlrChampMembers.length) {
    S.votes.push({ id: nid('v'), tour: valorant.id, by: 'u-lead', player: vlrChampMembers[0] })
    S.votes.push({ id: nid('v'), tour: valorant.id, by: 'u-ref', player: vlrChampMembers[1] ?? vlrChampMembers[0] })
  }

  /* ── the crowd had opinions ── */
  const talked = S.matches.find(m => m.tour === football.id && m.status === 'confirmed')
  if (talked) {
    S.comments.push({ id: nid('c'), match: talked.id, by: 'u-lead', text: 'Second half was a different match entirely.', at: daysAgo(6) })
    S.comments.push({ id: nid('c'), match: talked.id, by: 'u-play', text: 'That offside call is still wrong.', at: daysAgo(6) })
  }
  S.feedback.push({ id: nid('f'), tour: valorant.id, by: 'u-lead', rating: 4, text: 'Well run. The lobby codes went out late twice.', at: daysAgo(70) })
  S.feedback.push({ id: nid('f'), tour: valorant.id, by: 'u-play', rating: 5, text: '', at: daysAgo(68) })

  /* ── a standing club asking not to be swept away ── */
  S.permanentRequests.push({
    id: nid('pr'), team: 't-tit', by: S.teams.find(t => t.id === 't-tit')!.leader,
    reason: 'Titans have run since 2019 and enter one tournament a year, in March.',
    at: daysAgo(6), status: 'pending',
  })

  /* ── a few people already follow squads and players ── */
  S.follows.push('team:t-byt', 'player:u-ref')

  S.seq = n
  return S
}
