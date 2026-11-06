/**
 * src/features/tournament/BracketTab.tsx
 *
 * The match tree — one column per round, and the winner-path elbows drawn over
 * it. A round robin has no bracket at all: it gets a matchday list, and the
 * table lives on the leaderboard tab. Double elimination shows two trees and a
 * single grand final, with no bracket reset.
 *
 * Lines (UI plan 27 Oct) — one thin solid style, three meanings:
 *   elimination   winner path to the next match
 *   round robin   a rule between rounds only, never a winner path: nobody advances
 *   any format    "Highlight team" joins that team's matches round by round
 */
import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Field, MatchStateBadge, Panel, StatusBadge } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { TeamCrestView } from '../../components/kit/chips'
import { useTournamentMatches } from '../../hooks/useMatch'
import { matchStateOf, outcomeNote, toTeamView } from '../match/matchView'
import { useLtms } from '../../shared/store'
import { matchesOf, isOrg, regsOf, team } from '../../shared/selectors'
import { formatName, formatOf, matchStage, matchTag, nextOf, roundName } from '../../shared/rules'
import type { Match, Tournament } from '../../shared/types'
import type { MatchListItemDto } from '../../types/match.dto'
import { USE_MOCK } from '../../api/client'
import { hasValidBracket } from './hasValidBracket'
import { useTournamentBracket } from '../../hooks/useTournamentBracket'
import { doubleBracketColumns, roundColumns } from './bracketPresentation'
import type { BracketColumn } from './bracketPresentation'
import './bracket.css'

const HighlightTeam = createContext('')

function BracketWorkspace({ teams, children }: {
  teams: { id: string; name: string }[]; children: React.ReactNode
}) {
  const [selected, setSelected] = useState('')
  const scroll = useRef<HTMLDivElement>(null)
  const selectedName = teams.find(t => t.id === selected)?.name
  const move = (direction: number) => {
    const region = scroll.current
    // ใช้ scroll ของ browser เพื่อให้ปุ่ม ลูกศร และ trackpad เลื่อนพื้นที่เดียวกัน
    region?.scrollBy({ left: direction * Math.max(240, region.clientWidth * .75),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return <Panel quiet className="tour-bracket">
    <div className="spread tour-bracket-toolbar">
      <div><h2 className="journey-heading">Bracket</h2>
        <p className="sub" role="status">{selectedName ? `Highlighting ${selectedName}` : 'Choose a match to view details.'}</p>
      </div>
      <div className="hstack">
        <Field label="Highlight team" htmlFor="bracket-team"><select id="bracket-team" value={selected}
          onChange={e => setSelected(e.target.value)}><option value="">All teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></Field>
        <button className="btn" type="button" aria-label="Previous rounds" onClick={() => move(-1)}><Icon name="chevL" /></button>
        <button className="btn" type="button" aria-label="Next rounds" onClick={() => move(1)}><Icon name="chev" /></button>
      </div>
    </div>
    <HighlightTeam.Provider value={selected}>
      <div className="tour-bracket-scroll" ref={scroll} role="region" aria-label="Bracket matches" tabIndex={0}>{children}</div>
    </HighlightTeam.Provider>
  </Panel>
}

function ApiBracketNode({ m }: { m: MatchListItemDto }) {
  const navigate = useNavigate()
  const selected = useContext(HighlightTeam)
  const highlighted = [m.teamA, m.teamB].find(t => t && String(t.id) === selected)
  const score = m.score
  /* ใครชนะให้ backend บอก (B5 `outcome.winnerTeamId`) — เทียบสกอร์เองไม่พอ:
     คู่ถอน/ไม่มาไม่มีสกอร์ และกีฬาที่แต้มน้อยกว่าชนะก็มี */
  const winnerId = m.outcome?.winnerTeamId ?? null
  const winner = winnerId !== null
    ? (m.teamA?.id === winnerId ? 'a' : m.teamB?.id === winnerId ? 'b' : null)
    : score && score.a !== null && score.b !== null && score.a !== score.b
      ? (score.a > score.b ? 'a' : 'b')
      : null
  const state = matchStateOf(m)
  const note = outcomeNote(m)

  /* ช่องที่ว่างถาวรเพราะอีกฝั่งบายผ่าน ไม่ใช่ "ยังไม่รู้ว่าใคร" — TBD จึงผิด */
  const slot = (t: MatchListItemDto['teamA']) =>
    t === null && m.outcome?.kind === 'bye'
      ? <span className="nm sub">BYE</span>
      : t ? <Link className="bracket-team" to={`/team/${t.id}`} aria-label={t.name} title={t.name}>
        <TeamCrestView team={toTeamView(t)} size={20} /><span className="nm">{t.name}</span>
      </Link> : <span className="nm sub">TBD</span>

  return (
    <div className={`bnode tour-api-node ${state === 'disputed' ? 'act' : ''} ${highlighted ? 'tour-highlight' : ''}`}
      data-mid={m.id} data-next={m.nextMatchId ?? undefined}>
      {/* แยกปุ่มเปิดแมตช์กับลิงก์ทีม ให้ keyboard เลือกปลายทางได้โดยไม่ซ้อน control */}
      <button className="tour-node-open" type="button" aria-labelledby={`bracket-match-${m.id}`}
        onClick={() => navigate(`/m/${m.id}`)} />
      <span className="bracket-match-content" id={`bracket-match-${m.id}`}>
      <span className="bround">{m.tag || m.stage}</span>
      <span className="bracket-match-teams">
      {/* สกอร์มาจากผลของแต่ละนัด — ขีดกลางแปลว่ายังไม่มีผล ไม่ใช่ศูนย์ */}
      <span className={`brow ${winner === 'a' ? 'win' : winner === 'b' ? 'lose' : ''}`}>
        {slot(m.teamA)}
        <span className="sc">{m.score?.a ?? '—'}</span>
      </span>
      <span className={`brow ${winner === 'b' ? 'win' : winner === 'a' ? 'lose' : ''}`}>
        {slot(m.teamB)}
        <span className="sc">{m.score?.b ?? '—'}</span>
      </span>
      </span>
      <span className="bracket-match-meta">
        <MatchStateBadge state={state} />
        {note ? <span className="bracket-outcome">{note}</span> : null}
      </span>
      <MatchDate value={m.scheduledTime} />
      {highlighted ? <span className="tour-highlight-label">Highlighted team: {highlighted.name}</span> : null}
      </span>
    </div>
  )
}

function MatchDate({ value }: { value?: string | null }) {
  const date = value ? new Date(value) : null
  const known = date && Number.isFinite(date.getTime())
  return <span className="bracket-match-date"><Icon name="clock" size={11} />
    {known ? <time dateTime={value!} title="Bangkok time (UTC+7)">{new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok',
    }).format(date)}</time> : 'Time TBC'}
  </span>
}

function ApiColumns({ columns, roundRobin = false }: { columns: BracketColumn[]; roundRobin?: boolean }) {
  return <div className={`bracket${roundRobin ? ' bracket-rr' : ''}`}>
    {columns.map(column => <div className="bcol" key={column.key}>
      <h3 className="bcol-head">{column.label}</h3>
      <div className="bcol-matches">{column.matches.map(match => <ApiBracketNode key={match.id} m={match} />)}</div>
    </div>)}
  </div>
}

function ApiBracket({ matches, host, format, tournamentId }: {
  matches: MatchListItemDto[]; host: React.RefObject<HTMLDivElement | null>; format: string; tournamentId: number
}) {
  const roundRobin = format === 'roundrobin'
  const double = format === 'double'
  const structure = useTournamentBracket(tournamentId, double && !USE_MOCK && Number.isSafeInteger(tournamentId) && tournamentId > 0)
  const lanes = double && structure.data ? doubleBracketColumns(matches, structure.data) : null
  const teams = [...new Map(matches.flatMap(m => [m.teamA, m.teamB]).filter(t => t !== null)
    .map(t => [String(t.id), { id: String(t.id), name: t.name }])).values()]
  return (
    <BracketWorkspace teams={teams}>
    {double && structure.isFetching && !structure.data ? <p className="sub" role="status">Loading upper/lower bracket…</p> : null}
    {double && structure.isError ? <p className="sub" role="alert">{structure.data
      ? 'Could not refresh upper/lower sections. Showing the last available layout.'
      : 'Bracket sections are unavailable. Matches are shown by round.'} <button className="btn" type="button" onClick={() => void structure.refetch()}>Retry bracket sections</button></p> : null}
    <div ref={host} className="bracket-canvas">
      {lanes ? <>
        {lanes.upper.length ? <section aria-label="Winners bracket"><h3 className="bracket-lane-title">Upper bracket</h3><ApiColumns columns={lanes.upper} /></section> : null}
        {lanes.lower.length ? <section aria-label="Losers bracket"><h3 className="bracket-lane-title">Lower bracket</h3><ApiColumns columns={lanes.lower} /></section> : null}
        {lanes.other.length ? <section aria-label="Other matches"><h3 className="bracket-lane-title">Other matches</h3><ApiColumns columns={lanes.other} /></section> : null}
      </> : <ApiColumns columns={roundColumns(matches, roundRobin)} roundRobin={roundRobin} />}
    </div>
    <p className="bracket-timezone">Times shown in Bangkok (UTC+7). Green rows mark the winning team.</p>
    </BracketWorkspace>
  )
}

function BracketNode({ m }: { m: Match }) {
  const s = useLtms()
  const navigate = useNavigate()
  const selected = useContext(HighlightTeam)
  const highlighted = selected && (m.a === selected || m.b === selected) ? team(s, selected) : null
  const decided = m.status === 'confirmed'

  const row = (id: string | null, score: number | null, win: boolean, lose: boolean) => {
    const t = team(s, id)
    return (
      <span className={`brow ${win ? 'win' : lose ? 'lose' : ''}`}>
        {/* ใช้ตราเดียวกับที่อื่นทั้งแอป จะได้ขึ้นโลโก้ทีมด้วยถ้าหัวหน้าทีมตั้งไว้ */}
        {t
          ? <TeamCrestView team={{ id: t.id, name: t.name, code: t.code, color: t.color, logoUrl: t.logo ?? null }} size={20} />
          : <span className="bracket-empty-crest" />}
        <span className="nm" title={t?.name}>{t ? t.name : 'TBD'}</span>
        <span className="sc">{score ?? '—'}</span>
      </span>
    )
  }

  return (
    <button
      className={`bnode ${m.status === 'disputed' || m.status === 'pending' ? 'act' : ''} ${highlighted ? 'tour-highlight' : ''}`}
      type="button" data-mid={m.id} data-next={nextOf(s, m)?.id} onClick={() => navigate(`/m/${m.id}`)}
    >
      <span className="bround">{matchTag(s, m)}</span>
      <span className="bracket-match-teams">
      {row(m.a, m.sa, decided && (m.sa ?? 0) > (m.sb ?? 0), decided && (m.sa ?? 0) < (m.sb ?? 0))}
      {row(m.b, m.sb, decided && (m.sb ?? 0) > (m.sa ?? 0), decided && (m.sb ?? 0) < (m.sa ?? 0))}
      </span>
      <span className="bracket-match-meta"><StatusBadge m={m} /></span>
      <MatchDate value={m.kickoff} />
      {highlighted ? <span className="tour-highlight-label">Highlighted team: {highlighted.name}</span> : null}
    </button>
  )
}

/**
 * Winner-path connectors plus the highlighted team's path, one elbow each.
 * ใช้ nextMatchId จริงข้ามสายได้ด้วย โดยยึดกึ่งกลางแถวทีม ไม่ใช่ส่วนวันที่/สถานะ
 *
 * The elbows are measured off laid-out boxes, so any reflow invalidates them;
 * a highlight change only swaps classes, so class mutations redraw too.
 */
const elbow = (from: HTMLElement, to: HTMLElement, rect: DOMRect) => {
  const a = (from.querySelector('.bracket-match-teams') ?? from).getBoundingClientRect()
  const b = (to.querySelector('.bracket-match-teams') ?? to).getBoundingClientRect()
  const x1 = a.right - rect.left, y1 = a.top + a.height / 2 - rect.top
  const y2 = b.top + b.height / 2 - rect.top
  // สายล่างอาจจบคอลัมน์เดียวกับ Grand final จึงอ้อมขอบขวา ไม่ลากทับการ์ด
  if (b.left <= a.left) {
    const x2 = b.right - rect.left, mx = Math.max(x1, x2) + 20
    return `M${x1},${y1} H${mx} V${y2} H${x2}`
  }
  const x2 = b.left - rect.left
  const mx = (x1 + x2) / 2
  return `M${x1},${y1} H${mx} V${y2} H${x2}`
}

function useBracketLines(deps: unknown) {
  const host = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const draw = () => {
      const box = host.current
      if (!box) return
      box.querySelector('svg.bconn')?.remove()
      const rect = box.getBoundingClientRect()
      const paths: string[] = []
      // พบกันหมดไม่มีใครเข้ารอบต่อ — ห้ามลากเส้นผู้ชนะ แม้ข้อมูลจะมี next ติดมา
      box.querySelectorAll<HTMLElement>('.bnode[data-mid]').forEach(node => {
        if (node.closest('.bracket-rr')) return
        const nextId = node.dataset.next
        const target = nextId ? box.querySelector<HTMLElement>(`.bnode[data-mid="${nextId}"]`) : null
        if (target) paths.push(`<path${node.classList.contains('tour-highlight') && target.classList.contains('tour-highlight') ? ' class="team-path"' : ''} d="${elbow(node, target, rect)}"/>`)
      })
      // พบกันหมดเชื่อมเฉพาะเส้นทีมที่เลือก ไม่ตีความว่าเป็นการเลื่อนสาย
      const mine = [...box.querySelectorAll<HTMLElement>('.bracket-rr .bnode.tour-highlight')]
      mine.slice(1).forEach((node, i) => {
        const prev = mine[i]
        if (prev.closest('.bcol') !== node.closest('.bcol')) paths.push(`<path class="team-path" d="${elbow(prev, node, rect)}"/>`)
      })
      if (!paths.length) return
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'bconn')
      svg.setAttribute('aria-hidden', 'true')
      svg.innerHTML = paths.join('')
      box.prepend(svg)
    }
    draw()
    // ข้อความไฮไลต์และชื่อยาวอาจเปลี่ยนความสูงหลังวัดครั้งแรก
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw)
    if (host.current) observer?.observe(host.current)
    // เปลี่ยนทีมที่ไฮไลต์ = เปลี่ยน class ของการ์ด ไม่ได้เปลี่ยนขนาดเสมอไป
    const classes = typeof MutationObserver === 'undefined' ? null : new MutationObserver(records => {
      // รอผังแบ่งสายแล้วอาจเปลี่ยน DOM แต่การวาด svg ของเราเองต้องไม่สั่งวาดวนซ้ำ
      if (records.some(record => record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes]
        .some(node => !(node instanceof SVGElement && node.classList.contains('bconn'))))) draw()
    })
    if (host.current) classes?.observe(host.current, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
    addEventListener('resize', draw)
    return () => { observer?.disconnect(); classes?.disconnect(); removeEventListener('resize', draw) }
  }, [deps])
  return host
}

function Column({ label, list }: { label: string; list: Match[] }) {
  return (
    <div className="bcol">
      <h3 className="bcol-head">{label}</h3>
      <div className="bcol-matches">{list.map(m => <BracketNode key={m.id} m={m} />)}</div>
    </div>
  )
}

export function BracketTab({ t }: { t: Tournament }) {
  return USE_MOCK ? <MockBracketTab t={t} /> : <RealBracketTab t={t} />
}

function RealBracketTab({ t }: { t: Tournament }) {
  const id = Number(t.id)
  const validId = Number.isSafeInteger(id) && id > 0
  const matches = useTournamentMatches(validId ? id : undefined)
  const host = useBracketLines(matches.data?.items)
  if (!validId) return <Empty title="Invalid tournament ID" />
  if (matches.isPending) return <Panel quiet><span className="sub">Loading the bracket…</span></Panel>
  if (matches.isError) {
    const status = (matches.error as { status?: number } | null)?.status
    return <Empty title={status === 401 ? 'Sign in to view the bracket' : status === 403 ? 'You do not have access to this bracket' : 'Could not load the bracket'}>
      <button className="btn" type="button" onClick={() => void matches.refetch()}>Retry</button>
    </Empty>
  }
  if (!matches.data?.items.length) return <Empty title="No matches yet" sub="Matches will appear here once the fixtures are drawn." />
  if (!hasValidBracket(t, matches.data.items)) return <Empty title="No valid bracket yet" sub="Double elimination needs at least four approved squads before the bracket can be drawn." />
  return <ApiBracket matches={matches.data.items} host={host} format={formatOf(t)} tournamentId={id} />
}

function MockBracketTab({ t }: { t: Tournament }) {
  const s = useLtms()
  const navigate = useNavigate()
  const ms = matchesOf(s, t.id)
  const apiTournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  const apiMatches = useTournamentMatches(apiTournamentId)
  /* วาดใหม่เมื่อข้อมูลเปลี่ยน แม้จำนวนแมตช์เท่าเดิมหลังจับสายใหม่ */
  const host = useBracketLines(apiMatches.data?.items ?? ms)
  const rr = formatOf(t) === 'roundrobin'

  if (apiTournamentId !== undefined) {
    if (apiMatches.isPending) return <Panel quiet><span className="sub">Loading the bracket…</span></Panel>
    if (apiMatches.data?.items.length) return <ApiBracket matches={apiMatches.data.items} host={host} format={formatOf(t)} tournamentId={apiTournamentId} />
  }

  if (!t.drawn) {
    return (
      <Empty
        title={rr ? 'The fixtures have not been drawn' : "The bracket hasn't been drawn"}
        sub={`${regsOf(s, t.id).filter(r => r.status === 'approved').length} squads approved so far · ${formatName(t)}.`}
      >
        {isOrg(s, t) ? <button className="btn primary" type="button" onClick={() => navigate(`/t/${t.id}/manage`)}>Go to manage</button> : null}
      </Empty>
    )
  }

  const teams = [...new Set(ms.flatMap(m => [m.a, m.b]))].flatMap(id => {
    const t = team(s, id)
    return t ? [{ id: t.id, name: t.name }] : []
  })

  if (rr) {
    const days = [...new Set(ms.map(m => m.round))].sort((a, b) => a - b)
    return (
      <BracketWorkspace teams={teams}><div ref={host} className="bracket-canvas">
        {days.map(d => (
          <div key={d}>
            <div className="tag" style={{ marginTop: 8 }}>
              <em>//</em> {matchStage(s, ms.find(m => m.round === d)!)}
            </div>
            <div className="grid2">{ms.filter(m => m.round === d).map(m => <BracketNode key={m.id} m={m} />)}</div>
          </div>
        ))}
      </div></BracketWorkspace>
    )
  }

  const byRound = (list: Match[]) =>
    [...new Set(list.map(m => m.round))].sort((a, b) => a - b).map(r => list.filter(m => m.round === r))

  if (formatOf(t) === 'double') {
    const wb = ms.filter(m => m.bracket === 'W')
    const lb = ms.filter(m => m.bracket === 'L')
    const gf = ms.filter(m => m.bracket === 'GF')
    return (
      <BracketWorkspace teams={teams}><div ref={host} className="bracket-canvas">
        <h3 className="bracket-lane-title">Upper bracket</h3>
        <div className="bracket">
          {byRound(wb).map((c, i) => <Column key={i} label={matchStage(s, c[0])} list={c} />)}
          {gf.length ? <Column label="Grand final" list={gf} /> : null}
        </div>
        <h3 className="bracket-lane-title">Lower bracket</h3>
        <div className="bracket">
          {byRound(lb).map((c, i) => <Column key={i} label={matchStage(s, c[0])} list={c} />)}
        </div>
      </div></BracketWorkspace>
    )
  }

  const cols = Array.from({ length: t.rounds }, (_, r) => ms.filter(m => m.round === r))
  return (
    <BracketWorkspace teams={teams}><div ref={host} className="bracket-canvas">
      <div className="bracket">
        {cols.map((c, r) => <Column key={r} label={roundName(r, t.rounds)} list={c} />)}
      </div>
    </div></BracketWorkspace>
  )
}
