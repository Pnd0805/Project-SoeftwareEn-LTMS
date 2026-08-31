/**
 * src/components/kit/Scorebug.tsx
 *
 * The result, read at a glance. The winner carries the same view-transition-name
 * as its frontier bracket row, so confirming and then opening the bracket slides
 * the winner into its slot instead of just appearing there.
 *
 * ── สองชั้นเหมือน chips.tsx ────────────────────────────────────────────────
 * `ScorebugView` รับทุกอย่างเป็น prop — ทีม สกอร์ ป้าย และธง view-transition
 * `Scorebug` ตัวเดิมยังรับ `Match` ของ prototype แล้วไปค้น store เอง
 * ผู้เรียกเดิม (MatchPage, WatchPage) ไม่ต้องแก้อะไร
 */
import { Link } from 'react-router-dom'
import { useLtms } from '../../shared/store'
import { team, tour } from '../../shared/selectors'
import { bracketFrontier, matchTag, wonBy } from '../../shared/rules'
import { toTeamView, type TeamView } from './viewModels'
import type { Match } from '../../shared/types'

function Side({ t, score, lost, away, vt }: {
  t?: TeamView | null; score: number | null; lost: boolean; away: boolean; vt: boolean
}) {
  return (
    <div className={`sb-side ${away ? 'away' : ''}`} style={vt && t ? { viewTransitionName: `vt-team-${t.id}` } : undefined}>
      <span className="sb-flag" style={{ background: t?.color ?? 'var(--hairline)' }} />
      {t
        ? (
          <Link className="sb-name link" to={`/team/${t.id}`} title={`Open ${t.name}`}>
            <span className="sb-abbr">{t.code ?? '—'}</span><span className="sb-full">{t.name}</span>
          </Link>
        )
        : <span className="sb-name"><span className="sb-abbr">—</span><span className="sb-full">To be decided</span></span>}
      <span className={`sb-score ${lost ? 'lost' : ''}`}>{score ?? '—'}</span>
    </div>
  )
}

export interface ScorebugDecider { a: number; b: number; kind: string }

/** ชั้นล่าง — ไม่แตะ store เลย ใครมีข้อมูลก็วาดได้ */
export function ScorebugView({ home, away, scoreA, scoreB, tag, decided, decider, homeLost, awayLost, vtHome, vtAway }: {
  home?: TeamView | null
  away?: TeamView | null
  scoreA: number | null
  scoreB: number | null
  /** ป้ายกลางจอ เช่น "Semi-final" */
  tag: string
  /** จบแล้วหรือยัง — คุม FT / AET / vs ตรงกลาง */
  decided: boolean
  decider?: ScorebugDecider | null
  /**
   * ฝั่งไหนแพ้ — ผู้เรียกเป็นคนบอก ห้ามเดาจากสกอร์
   * เสมอ 2–2 แล้วตัดสินด้วยจุดโทษก็ยังมีฝั่งที่แพ้ ซึ่งดูจากสกอร์อย่างเดียวไม่เห็น
   */
  homeLost?: boolean
  awayLost?: boolean
  /** ผู้ชนะฝั่งนี้ต่อ view-transition เข้าช่อง bracket หรือไม่ */
  vtHome?: boolean
  vtAway?: boolean
}) {
  return (
    <div className="scorebug">
      <Side t={home} score={scoreA} lost={!!homeLost} away={false} vt={!!vtHome} />
      <div className="sb-mid">
        <span className="tag">{tag}</span>
        <span className="sb-clock">{decided ? (decider ? 'AET' : 'FT') : 'vs'}</span>
        {decider
          ? <span className="tag" style={{ textAlign: 'center' }}>{decider.a}–{decider.b}<br />{decider.kind}</span>
          : null}
      </div>
      <Side t={away} score={scoreB} lost={!!awayLost} away vt={!!vtAway} />
    </div>
  )
}

/** ชั้นเดิม — รับ `Match` ของ prototype, ค้น store, แล้วส่งต่อให้ชั้นล่าง */
export function Scorebug({ m }: { m: Match }) {
  const s = useLtms()
  const A = team(s, m.a), B = team(s, m.b)
  const t = tour(s, m.tour)
  const decided = m.status === 'confirmed'
  const frontier = decided && t ? bracketFrontier(s, t.id) : new Map()

  return (
    <ScorebugView
      home={A ? toTeamView(A) : null}
      away={B ? toTeamView(B) : null}
      scoreA={m.sa}
      scoreB={m.sb}
      tag={matchTag(s, m)}
      decided={decided}
      decider={m.decider}
      homeLost={decided && !wonBy(m, m.a)}
      awayLost={decided && !wonBy(m, m.b)}
      vtHome={!!(A && decided && wonBy(m, m.a) && frontier.get(A.id)?.matchId === m.id)}
      vtAway={!!(B && decided && wonBy(m, m.b) && frontier.get(B.id)?.matchId === m.id)}
    />
  )
}
