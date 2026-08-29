/**
 * src/features/tournament/BracketTab.tsx
 *
 * The match tree — one column per round, and the winner-path elbows drawn over
 * it. A round robin has no bracket at all: it gets a matchday list, and the
 * table lives on the leaderboard tab. Double elimination shows two trees and a
 * single grand final, with no bracket reset.
 */
import { useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty, StatusBadge } from '../../components/kit/primitives'
import { useLtms } from '../../shared/store'
import { matchesOf, isOrg, regsOf, team } from '../../shared/selectors'
import { formatName, formatOf, matchStage, matchTag, nextOf, roundName } from '../../shared/rules'
import type { Match, Tournament } from '../../shared/types'

function BracketNode({ m }: { m: Match }) {
  const s = useLtms()
  const navigate = useNavigate()
  const decided = m.status === 'confirmed'

  const row = (id: string | null, score: number | null, win: boolean, lose: boolean) => {
    const t = team(s, id)
    return (
      <span className={`brow ${win ? 'win' : lose ? 'lose' : ''}`}>
        <i style={{ background: t ? t.color : 'var(--hairline)' }} />
        <span className="nm">{t ? t.name : 'TBD'}</span>
        <span className="sc">{score ?? '—'}</span>
      </span>
    )
  }

  return (
    <button
      className={`bnode ${m.status === 'disputed' || m.status === 'pending' ? 'act' : ''}`}
      type="button" data-mid={m.id} data-next={nextOf(s, m)?.id} onClick={() => navigate(`/m/${m.id}`)}
    >
      <span className="bhead">
        <span className="tag"><em>//</em> {matchTag(s, m)}</span>
        <StatusBadge m={m} />
      </span>
      {row(m.a, m.sa, decided && (m.sa ?? 0) > (m.sb ?? 0), decided && (m.sa ?? 0) < (m.sb ?? 0))}
      {row(m.b, m.sb, decided && (m.sb ?? 0) > (m.sa ?? 0), decided && (m.sb ?? 0) < (m.sa ?? 0))}
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
    addEventListener('resize', draw)
    return () => removeEventListener('resize', draw)
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
  const s = useLtms()
  const navigate = useNavigate()
  const ms = matchesOf(s, t.id)
  const host = useBracketLines(ms.length)
  const rr = formatOf(t) === 'roundrobin'

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

  if (rr) {
    const days = [...new Set(ms.map(m => m.round))].sort((a, b) => a - b)
    return (
      <div ref={host}>
        {days.map(d => (
          <div key={d}>
            <div className="tag" style={{ marginTop: 8 }}>
              <em>//</em> {matchStage(s, ms.find(m => m.round === d)!)}
            </div>
            <div className="grid2">{ms.filter(m => m.round === d).map(m => <BracketNode key={m.id} m={m} />)}</div>
          </div>
        ))}
      </div>
    )
  }

  const byRound = (list: Match[]) =>
    [...new Set(list.map(m => m.round))].sort((a, b) => a - b).map(r => list.filter(m => m.round === r))

  if (formatOf(t) === 'double') {
    const wb = ms.filter(m => m.bracket === 'W')
    const lb = ms.filter(m => m.bracket === 'L')
    const gf = ms.filter(m => m.bracket === 'GF')
    return (
      <div ref={host}>
        <div className="tag"><em>//</em> Winners bracket</div>
        <div className="tblwrap"><div className="bracket">
          {byRound(wb).map((c, i) => <Column key={i} label={matchStage(s, c[0])} list={c} />)}
        </div></div>
        <div className="tag" style={{ marginTop: 10 }}>
          <em>//</em> Losers bracket — a first loss sends you here, a second sends you home
        </div>
        <div className="tblwrap"><div className="bracket">
          {byRound(lb).map((c, i) => <Column key={i} label={matchStage(s, c[0])} list={c} />)}
        </div></div>
        {gf.length ? (
          <>
            <div className="tag" style={{ marginTop: 10 }}><em>//</em> Grand final — one match, no bracket reset</div>
            <div className="grid2">{gf.map(m => <BracketNode key={m.id} m={m} />)}</div>
          </>
        ) : null}
      </div>
    )
  }

  const cols = Array.from({ length: t.rounds }, (_, r) => ms.filter(m => m.round === r))
  return (
    <div ref={host}>
      <div className="tblwrap"><div className="bracket">
        {cols.map((c, r) => <Column key={r} label={roundName(r, t.rounds)} list={c} />)}
      </div></div>
    </div>
  )
}
