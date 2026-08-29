/**
 * src/components/kit/Scorebug.tsx
 *
 * The result, read at a glance. The winner carries the same view-transition-name
 * as its frontier bracket row, so confirming and then opening the bracket slides
 * the winner into its slot instead of just appearing there.
 */
import { Link } from 'react-router-dom'
import { useLtms } from '../../shared/store'
import { team, tour } from '../../shared/selectors'
import { bracketFrontier, matchTag, wonBy } from '../../shared/rules'
import type { Match, Team } from '../../shared/types'

function Side({ t, score, lost, away, vt }: {
  t?: Team | null; score: number | null; lost: boolean; away: boolean; vt: boolean
}) {
  return (
    <div className={`sb-side ${away ? 'away' : ''}`} style={vt && t ? { viewTransitionName: `vt-team-${t.id}` } : undefined}>
      <span className="sb-flag" style={{ background: t ? t.color : 'var(--hairline)' }} />
      {t
        ? (
          <Link className="sb-name link" to={`/team/${t.id}`} title={`Open ${t.name}`}>
            <span className="sb-abbr">{t.code}</span><span className="sb-full">{t.name}</span>
          </Link>
        )
        : <span className="sb-name"><span className="sb-abbr">—</span><span className="sb-full">To be decided</span></span>}
      <span className={`sb-score ${lost ? 'lost' : ''}`}>{score ?? '—'}</span>
    </div>
  )
}

export function Scorebug({ m }: { m: Match }) {
  const s = useLtms()
  const A = team(s, m.a), B = team(s, m.b)
  const t = tour(s, m.tour)
  const decided = m.status === 'confirmed'
  const frontier = decided && t ? bracketFrontier(s, t.id) : new Map()

  return (
    <div className="scorebug">
      <Side t={A} score={m.sa} lost={decided && !wonBy(m, m.a)} away={false}
        vt={!!(A && decided && wonBy(m, m.a) && frontier.get(A.id)?.matchId === m.id)} />
      <div className="sb-mid">
        <span className="tag">{matchTag(s, m)}</span>
        <span className="sb-clock">{decided ? (m.decider ? 'AET' : 'FT') : 'vs'}</span>
        {m.decider
          ? <span className="tag" style={{ textAlign: 'center' }}>{m.decider.a}–{m.decider.b}<br />{m.decider.kind}</span>
          : null}
      </div>
      <Side t={B} score={m.sb} lost={decided && !wonBy(m, m.b)} away
        vt={!!(B && decided && wonBy(m, m.b) && frontier.get(B.id)?.matchId === m.id)} />
    </div>
  )
}
