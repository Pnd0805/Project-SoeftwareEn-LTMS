/**
 * src/features/tournament/BracketTab.tsx
 *
 * The match tree — one column per round, and the winner-path elbows drawn over
 * it. A round robin has no bracket at all: it gets a matchday list, and the
 * table lives on the leaderboard tab. Double elimination shows two trees and a
 * single grand final, with no bracket reset.
 */
import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty, Field, MatchStateBadge, Panel, StatusBadge } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { TeamLinkView } from '../../components/kit/chips'
import { useTournamentMatches } from '../../hooks/useMatch'
import { matchStateOf, outcomeNote, toTeamView } from '../match/matchView'
import { useLtms } from '../../shared/store'
import { matchesOf, isOrg, regsOf, team } from '../../shared/selectors'
import { TeamMarkView } from '../../components/kit/chips'
import { formatName, formatOf, matchStage, matchTag, nextOf, roundName } from '../../shared/rules'
import type { Match, Tournament } from '../../shared/types'
import type { MatchListItemDto } from '../../types/match.dto'
import { USE_MOCK } from '../../api/client'
import { hasValidBracket } from './hasValidBracket'

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
      ? <span className="sub">BYE</span>
      : <TeamLinkView team={toTeamView(t)} />

  return (
    <div className={`bnode tour-api-node ${state === 'disputed' ? 'act' : ''} ${highlighted ? 'tour-highlight' : ''}`}
      data-mid={m.id} data-next={m.nextMatchId ?? undefined}>
      {/* แยกปุ่มเปิดแมตช์กับลิงก์ทีม ให้ keyboard เลือกปลายทางได้โดยไม่ซ้อน control */}
      <button className="tour-node-open" type="button" aria-labelledby={`bracket-match-${m.id}`}
        onClick={() => navigate(`/m/${m.id}`)} />
      <span id={`bracket-match-${m.id}`}>
      <span className="bhead">
        <span className="tag"><em>//</em> {m.tag || m.stage}</span>
        <MatchStateBadge state={state} />
      </span>
      {/* บายมีสกอร์ประจำกีฬาติดมาด้วย (บาส 20-0 แบด 2-0) ถ้าไม่บอกก็ดูเหมือนแข่งจริง */}
      {note ? <span className="sub" style={{ padding: '0 8px' }}>{note}</span> : null}
      {/* สกอร์มาจากผลของแต่ละนัด — ขีดกลางแปลว่ายังไม่มีผล ไม่ใช่ศูนย์ */}
      <span className={`brow ${winner === 'a' ? 'win' : winner === 'b' ? 'lose' : ''}`}>
        {slot(m.teamA)}
        <span className="sc">{m.score?.a ?? '—'}</span>
      </span>
      <span className={`brow ${winner === 'b' ? 'win' : winner === 'a' ? 'lose' : ''}`}>
        {slot(m.teamB)}
        <span className="sc">{m.score?.b ?? '—'}</span>
      </span>
      {highlighted ? <span className="tour-highlight-label">Highlighted team: {highlighted.name}</span> : null}
      </span>
    </div>
  )
}

function ApiBracket({ matches, host }: { matches: MatchListItemDto[]; host: React.RefObject<HTMLDivElement | null> }) {
  const rounds = [...new Set(matches.map(match => match.roundNumber ?? 0))].sort((a, b) => a - b)
  const teams = [...new Map(matches.flatMap(m => [m.teamA, m.teamB]).filter(t => t !== null)
    .map(t => [String(t.id), { id: String(t.id), name: t.name }])).values()]
  return (
    <BracketWorkspace teams={teams}>
    <div ref={host}>
        <div className="bracket">
          {rounds.map(round => (
            <div className="bcol" key={round}>
              {/* roundNumber ของ backend เริ่มที่ 1 อยู่แล้ว — เดิม +1 ทำให้หัวคอลัมน์
                  เป็น "Round 2" ขณะที่การ์ดข้างในเขียนว่า "Round 1" */}
              <div className="tag" style={{ textAlign: 'center' }}><em>//</em> Round {round}</div>
              {matches.filter(match => (match.roundNumber ?? 0) === round).map(match => (
                <ApiBracketNode key={match.id} m={match} />
              ))}
            </div>
          ))}
        </div>
    </div>
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
          ? <TeamMarkView team={{ id: t.id, name: t.name, code: t.code, color: t.color, logoUrl: t.logo ?? null }} />
          : <i style={{ background: 'var(--hairline)' }} />}
        <span className="nm">{t ? t.name : 'TBD'}</span>
        <span className="sc">{score ?? '—'}</span>
      </span>
    )
  }

  return (
    <button
      className={`bnode ${m.status === 'disputed' || m.status === 'pending' ? 'act' : ''} ${highlighted ? 'tour-highlight' : ''}`}
      type="button" data-mid={m.id} data-next={nextOf(s, m)?.id} onClick={() => navigate(`/m/${m.id}`)}
    >
      <span className="bhead">
        <span className="tag"><em>//</em> {matchTag(s, m)}</span>
        <StatusBadge m={m} />
      </span>
      {row(m.a, m.sa, decided && (m.sa ?? 0) > (m.sb ?? 0), decided && (m.sa ?? 0) < (m.sb ?? 0))}
      {row(m.b, m.sb, decided && (m.sb ?? 0) > (m.sa ?? 0), decided && (m.sb ?? 0) < (m.sa ?? 0))}
      {highlighted ? <span className="tour-highlight-label">Highlighted team: {highlighted.name}</span> : null}
    </button>
  )
}

/**
 * Winner-path connectors only: one elbow per match that has a next match in the
 * same box. Losers-bracket and grand-final edges cross boxes and are left
 * unconnected — ponytail: add a second pass if that is ever wanted.
 *
 * The elbows are measured off laid-out boxes, so any reflow invalidates them.
 */
function useBracketLines(deps: unknown) {
  const host = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const draw = () => {
      host.current?.querySelectorAll<HTMLElement>('.bracket').forEach(box => {
        box.querySelector('svg.bconn')?.remove()
        const rect = box.getBoundingClientRect()
        const paths: string[] = []
        box.querySelectorAll<HTMLElement>('.bnode[data-mid]').forEach(node => {
          const nextId = node.dataset.next
          const target = nextId ? box.querySelector<HTMLElement>(`.bnode[data-mid="${nextId}"]`) : null
          if (!target) return
          const a = node.getBoundingClientRect(), b = target.getBoundingClientRect()
          const x1 = a.right - rect.left, y1 = a.top + a.height / 2 - rect.top
          const x2 = b.left - rect.left, y2 = b.top + b.height / 2 - rect.top
          const mx = (x1 + x2) / 2
          paths.push(`<path d="M${x1},${y1} H${mx} V${y2} H${x2}"/>`)
        })
        if (!paths.length) return
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('class', 'bconn')
        svg.innerHTML = paths.join('')
        box.prepend(svg)
      })
    }
    draw()
    // ข้อความไฮไลต์และชื่อยาวอาจเปลี่ยนความสูงหลังวัดครั้งแรก
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw)
    host.current?.querySelectorAll('.bnode').forEach(node => observer?.observe(node))
    addEventListener('resize', draw)
    return () => { observer?.disconnect(); removeEventListener('resize', draw) }
  }, [deps])
  return host
}

function Column({ label, list }: { label: string; list: Match[] }) {
  return (
    <div className="bcol">
      <div className="tag" style={{ textAlign: 'center' }}><em>//</em> {label}</div>
      {list.map(m => <BracketNode key={m.id} m={m} />)}
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
  const host = useBracketLines(matches.data?.items.length ?? 0)
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
  return <ApiBracket matches={matches.data.items} host={host} />
}

function MockBracketTab({ t }: { t: Tournament }) {
  const s = useLtms()
  const navigate = useNavigate()
  const ms = matchesOf(s, t.id)
  const apiTournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  const apiMatches = useTournamentMatches(apiTournamentId)
  /* useBracketLines ใช้ deps เพื่อ re-draw เมื่อข้อมูลเปลี่ยน — ใช้จำนวนแมตช์จาก API ถ้ามี */
  const host = useBracketLines(apiMatches.data?.items.length ?? ms.length)
  const rr = formatOf(t) === 'roundrobin'

  if (apiTournamentId !== undefined) {
    if (apiMatches.isPending) return <Panel quiet><span className="sub">Loading the bracket…</span></Panel>
    if (apiMatches.data?.items.length) return <ApiBracket matches={apiMatches.data.items} host={host} />
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
      <BracketWorkspace teams={teams}><div ref={host}>
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
      <BracketWorkspace teams={teams}><div ref={host}>
        <div className="tag"><em>//</em> Winners bracket</div>
        <div className="bracket">
          {byRound(wb).map((c, i) => <Column key={i} label={matchStage(s, c[0])} list={c} />)}
        </div>
        <div className="tag" style={{ marginTop: 10 }}>
          <em>//</em> Losers bracket — a first loss sends you here, a second sends you home
        </div>
        <div className="bracket">
          {byRound(lb).map((c, i) => <Column key={i} label={matchStage(s, c[0])} list={c} />)}
        </div>
        {gf.length ? (
          <>
            <div className="tag" style={{ marginTop: 10 }}><em>//</em> Grand final — one match, no bracket reset</div>
            <div className="grid2">{gf.map(m => <BracketNode key={m.id} m={m} />)}</div>
          </>
        ) : null}
      </div></BracketWorkspace>
    )
  }

  const cols = Array.from({ length: t.rounds }, (_, r) => ms.filter(m => m.round === r))
  return (
    <BracketWorkspace teams={teams}><div ref={host}>
      <div className="bracket">
        {cols.map((c, r) => <Column key={r} label={roundName(r, t.rounds)} list={c} />)}
      </div>
    </div></BracketWorkspace>
  )
}
