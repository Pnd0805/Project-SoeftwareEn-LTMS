import { Banner, Field } from '../../components/kit/primitives'
import type { MatchDto } from '../../types/match.dto'

type Format = Pick<MatchDto, 'bestOf' | 'possibleScores'>
export function ScoreInputs({ match, a, b, setA, setB, disabled = false, prefix, labelA, labelB }: {
  match: Format & Pick<MatchDto, 'teamA' | 'teamB'>
  a: number; b: number; setA: (n: number) => void; setB: (n: number) => void
  disabled?: boolean; prefix: string; labelA?: string; labelB?: string
}) {
  const nameA = match.teamA?.name ?? 'Home'
  const nameB = match.teamB?.name ?? 'Away'
  if (match.bestOf != null) return <div className="vstack">
    <span className="tag">BO{match.bestOf} — choose the winning score</span>
    {!match.possibleScores?.length ? <Banner kind="crit">ตัวเลือกคะแนนยังโหลดไม่ครบ กรุณาโหลดแมตช์ใหม่ก่อนส่งผล</Banner> : <div className="hstack" style={{ flexWrap: 'wrap' }}>
      {match.possibleScores.flatMap(([win, loss]) => [[win, loss], [loss, win]]).map(([sa, sb]) => <button className={`btn ${a === sa && b === sb ? 'primary' : 'ghost'}`} aria-pressed={a === sa && b === sb} type="button" key={`${sa}-${sb}`} disabled={disabled} onClick={() => { setA(sa); setB(sb) }}>{nameA} {sa} – {sb} {nameB}</button>)}
    </div>}
  </div>
  return <div className="grid2" style={{ maxWidth: 420 }}>
    <Field label={labelA ?? nameA} htmlFor={`${prefix}-a`}><input id={`${prefix}-a`} type="number" min={0} max={999} step={1} value={a} disabled={disabled} onChange={e => setA(Number(e.target.value))} /></Field>
    <Field label={labelB ?? nameB} htmlFor={`${prefix}-b`}><input id={`${prefix}-b`} type="number" min={0} max={999} step={1} value={b} disabled={disabled} onChange={e => setB(Number(e.target.value))} /></Field>
  </div>
}
