/**
 * Pick'em บนหน้าแมตช์ — ทายเป็นสกอร์ (OD-56 · 4 ต.ค.)
 *
 * เดิมกดเลือกทีมแล้วส่ง { teamId } ซึ่ง backend ไม่รับแล้ว ทายผลได้ 400 ทุกครั้ง · ตอนนี้ทายสกอร์สองฝั่ง
 * แล้วระบบอนุมานผู้ชนะเอง ทายเสมอไม่ได้ (ไม่มีผู้ชนะให้อนุมาน)
 *
 * กฎแต้มอ่านจาก GET /matches/:id + GET /sport-types (OD-69) ไม่เขียนเลขไว้ในโค้ด — เส้นอยู่ในฐาน ผู้จัดแก้ได้ ถ้า hardcode
 * วันที่มีคนแก้ หน้าจอจะบอกกฎอย่างหนึ่งแต่ได้แต้มอีกอย่าง โดยที่ API ยังตอบ 200 และไม่มีอะไรพังให้เห็น
 * แต้มที่ได้เป็น 10 / 7 / 4 / 0 — "ได้แต้ม" (> 0) ยังเท่ากับ "ทายฝั่งถูก" แต่ 10 แปลว่า "ทายเต็ม" เท่านั้น
 */
import { useState } from 'react'
import { Badge, Empty, Panel } from '../../components/kit/primitives'
import { ScoreInputs } from './ScoreInputs'
import { scoreFormatFromError, validMatchScore } from './scoreFormat'
import { usePredictionLive } from '../../hooks/useLiveEngagement'
import { useSportTypes } from '../../hooks/useReference'
import type { MatchDto } from '../../types/match.dto'
import { pickLabel, pickemRules } from './pickemRules'

export function LivePickem({ match }: { match: MatchDto }) {
  const prediction = usePredictionLive(match.id)
  const sports = useSportTypes()
  const data = prediction.query.data
  const mine = data?.mine
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)

  if (prediction.query.isPending) return <Panel quiet><span className="sub">Loading Pick'em…</span></Panel>
  if (prediction.query.isError) return <Empty icon="warn" title="Unable to load Pick'em" sub={prediction.query.error instanceof Error ? prediction.query.error.message : undefined} />
  if (!match.teamA || !match.teamB) return null

  const teamA = match.teamA
  const teamB = match.teamB
  const savedA = mine?.scoreData?.[String(teamA.id)]
  const savedB = mine?.scoreData?.[String(teamB.id)]
  const valueA = a ?? savedA ?? 0
  const valueB = b ?? savedB ?? 0
  const level = valueA === valueB
  const busy = prediction.place.isPending || prediction.cancel.isPending
  const error = prediction.place.error ?? prediction.cancel.error
  const format = scoreFormatFromError(match, prediction.place.error)
  const sport = sports.data?.items.find(s => s.id === match.tournament.sportTypeId)
  const rules = pickemRules(sport, match.pickemTolerance)
  const settled = mine && mine.pointsEarned !== null && (mine.status === 'won' || mine.status === 'lost')

  return <Panel quiet>
    <div className="spread"><span className="tag"><em>//</em> Pick'em · {data?.total ?? 0} predictions</span>
      {mine ? <Badge kind={mine.status === 'won' ? 'ok' : mine.status === 'lost' ? 'crit' : 'neutral'}>
        {settled ? `${pickLabel(mine.pointsEarned ?? 0, sport?.pickemPoints)} · +${mine.pointsEarned} points`
          : mine.status === 'void' ? 'Void' : 'Waiting for the result'}
      </Badge> : null}</div>
    {!data?.isOpen ? <p className="sub">Predictions closed{['finished', 'completed'].includes(match.status) ? ': match finished' : data?.closedReason ? `: ${data.closedReason.replaceAll('_', ' ')}` : ''}.</p> : null}
    {data?.closesAt ? <p className="sub">Scheduled kick-off: {new Date(data.closesAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}</p> : null}
    {error ? <p className="sub" role="alert">{error instanceof Error ? error.message : 'Could not update prediction.'}</p> : null}
    <div className="sub">{data?.teams.map(row => `${row.teamId === teamA.id ? teamA.name : teamB.name} ${row.percent}%`).join(' · ')}</div>
    {data?.canPredict ? <>
      <ScoreInputs match={{ ...match, ...format }} a={valueA} b={valueB} setA={setA} setB={setB} prefix="pick" disabled={busy} />
      {level ? <p className="sub">Draws can&apos;t be predicted — put the side you think wins ahead.</p> : null}
      <div className="hstack">
        <button className="btn primary" type="button" disabled={busy || !validMatchScore(format, valueA, valueB)}
          onClick={() => prediction.place.mutate({ [String(teamA.id)]: valueA, [String(teamB.id)]: valueB })}>
          {mine ? 'Update my prediction' : 'Predict this score'}
        </button>
        {mine ? <button className="btn ghost" type="button" disabled={busy} onClick={() => prediction.cancel.mutate()}>Cancel prediction</button> : null}
      </div>
    </> : null}
    {mine && savedA !== undefined && savedB !== undefined ? <p className="sub">Your prediction: {teamA.name} {savedA} – {savedB} {teamB.name}</p> : null}
    {rules ? <div className="sub">How points work for this match:<ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{rules.map(line => <li key={line}>{line}</li>)}</ul></div> : null}
    {!data?.canPredict && data?.isOpen ? <p className="sub">Sign in as an eligible spectator to predict this match.</p> : null}
  </Panel>
}
