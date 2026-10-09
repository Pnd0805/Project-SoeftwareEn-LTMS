import { useState } from 'react'
import { matchTime } from './matchTime'
import { Badge, Empty, Field, Panel } from '../../components/kit/primitives'
import { useSportTypes } from '../../hooks/useReference'
import { pickLabel, pickemRules } from './pickemRules'
import { scoreFormatFromError, validMatchScore } from './scoreFormat'
import { usePredictionLive } from '../../hooks/useLiveEngagement'
import type { MatchDto } from '../../types/match.dto'

/* ช่องว่าง = ยังไม่ได้กรอก ไม่ใช่ 0 — Number('') ได้ 0 ซึ่งจะกลายเป็นคำทาย 0 แต้มโดยไม่ตั้งใจ */
const toScore = (text: string) => (/^\d{1,3}$/.test(text.trim()) ? Number(text) : null)

/**
 * Pick'em ของแมตช์ — ทายเป็น "สกอร์" (OD-56, 4 ต.ค.)
 *
 * ของเดิมเป็นปุ่มเลือกทีมและส่ง `{ teamId }` ซึ่ง backend เลิกรับแล้ว จึงโดนปฏิเสธทุกครั้ง
 * backend อนุมานผู้ชนะจากฝั่งที่แต้มมากกว่าเอง ฟอร์มจึงมีแค่สกอร์สองช่อง ไม่ให้เลือกทีมซ้ำ
 * (ส่งทั้งสองอย่างจะขัดกันเองได้)
 *
 * ใช้ bestOf และกติกาแต้มจาก backend เมื่อมีค่า (BO3 = 2–0 หรือ 2–1)
 * แมตช์ที่ไม่มีข้อมูลรูปแบบยังตรวจจำนวนเต็ม 0–999 และไม่เสมอ โดย server ตรวจซ้ำเมื่อส่ง
 */
export function LivePickem({ match }: { match: MatchDto }) {
  const prediction = usePredictionLive(match.id)
  const sports = useSportTypes()
  const data = prediction.query.data
  /* null = ผู้ใช้ยังไม่แตะช่องนั้น ให้แสดงคำทายที่บันทึกไว้ — เก็บ draft แยกแทนการ sync state ใน effect */
  const [draft, setDraft] = useState<{ a: string | null; b: string | null }>({ a: null, b: null })
  if (prediction.query.isPending) return <Panel quiet><span className="sub">Loading Pick'em…</span></Panel>
  if (prediction.query.isError) return <Empty icon="warn" title="Unable to load Pick'em" sub={prediction.query.error instanceof Error ? prediction.query.error.message : undefined} />
  const busy = prediction.place.isPending || prediction.cancel.isPending
  const error = prediction.place.error ?? prediction.cancel.error
  const { teamA, teamB } = match
  const mine = data?.mine ?? null
  const saved = (teamId: number | undefined) => {
    const value = teamId === undefined ? undefined : mine?.scoreData?.[String(teamId)]
    return value === undefined ? '' : String(value)
  }
  const textA = draft.a ?? saved(teamA?.id)
  const textB = draft.b ?? saved(teamB?.id)
  const scoreA = toScore(textA), scoreB = toScore(textB)
  const tie = scoreA !== null && scoreB !== null && scoreA === scoreB
  const format = scoreFormatFromError(match, prediction.place.error)
  const sport = sports.data?.items.find(s => s.id === match.tournament.sportTypeId)
  const rules = pickemRules(sport, match.pickemTolerance)
  const settled = mine && mine.pointsEarned !== null && (mine.status === 'won' || mine.status === 'lost')
  const ready = !!teamA && !!teamB && scoreA !== null && scoreB !== null && !tie && validMatchScore(format, scoreA, scoreB)
  const winner = ready ? (scoreA > scoreB ? teamA : teamB) : null
  const unchanged = ready && mine?.scoreData?.[String(teamA.id)] === scoreA && mine?.scoreData?.[String(teamB.id)] === scoreB
  const pickedTeam = mine ? [teamA, teamB].find(team => team?.id === mine.teamId) ?? null : null
  const submit = () => {
    if (!ready) return
    prediction.place.mutate({ [String(teamA.id)]: scoreA, [String(teamB.id)]: scoreB }, {
      onSuccess: () => setDraft({ a: null, b: null }),
    })
  }
  return <Panel quiet className="match-predictions">
    <div className="spread"><span className="tag"><em>//</em> Pick'em · {data?.total ?? 0} predictions</span>
      {mine ? <Badge kind={mine.status === 'won' ? 'ok' : mine.status === 'lost' ? 'crit' : 'neutral'}>
        {settled ? `${pickLabel(mine.pointsEarned ?? 0, sport?.pickemPoints)} · +${mine.pointsEarned} points` : mine.status === 'void' ? 'Void' : mine.status}
      </Badge> : null}</div>
    {!data?.isOpen ? <p className="sub">Predictions closed{data?.closedReason ? `: ${data.closedReason.replaceAll('_', ' ')}` : ''}.</p> : null}
    {data?.closesAt ? <p className="sub">Scheduled kick-off: {matchTime(data.closesAt)}</p> : null}
    {mine ? <p><b>Your prediction:</b>{' '}
      {mine.scoreData && teamA && teamB
        ? `${teamA.name} ${saved(teamA.id)} – ${saved(teamB.id)} ${teamB.name}`
        : `${pickedTeam?.name ?? 'Team'} to win`}
    </p> : null}
    {data?.canPredict && teamA && teamB ? <form className="vstack" onSubmit={event => { event.preventDefault(); submit() }}>
      <span className="sub">Predict the final score. The side with the higher score is your pick to win.</span>
      <div className="grid2 match-score-inputs">
        <Field label={teamA.name} htmlFor="pk-a">
          <input id="pk-a" type="number" inputMode="numeric" min={0} max={format.bestOf != null ? Math.ceil(format.bestOf / 2) : 999} step={1} disabled={busy} aria-invalid={tie}
            value={textA} onChange={event => setDraft(current => ({ ...current, a: event.target.value }))} />
        </Field>
        <Field label={teamB.name} htmlFor="pk-b">
          <input id="pk-b" type="number" inputMode="numeric" min={0} max={format.bestOf != null ? Math.ceil(format.bestOf / 2) : 999} step={1} disabled={busy} aria-invalid={tie}
            value={textB} onChange={event => setDraft(current => ({ ...current, b: event.target.value }))} />
        </Field>
      </div>
      {tie ? <p className="sub" role="alert">A draw cannot be predicted — one side needs the higher score.</p> : null}
      {winner ? <p className="sub">Your pick: <b>{winner.name}</b> to win {Math.max(scoreA!, scoreB!)}–{Math.min(scoreA!, scoreB!)}.</p> : null}
      {error ? <p className="sub" role="alert">{error instanceof Error ? error.message : 'Could not update prediction.'}</p> : null}
      <div className="hstack">
        <button className="btn primary" type="submit" disabled={!ready || busy || unchanged}>
          {mine ? 'Update prediction' : 'Predict score'}
        </button>
        {mine ? <button className="btn ghost" type="button" disabled={busy}
          onClick={() => prediction.cancel.mutate(undefined, { onSuccess: () => setDraft({ a: null, b: null }) })}>Cancel prediction</button> : null}
      </div>
    </form> : null}
    {!data?.canPredict && error ? <p className="sub" role="alert">{error instanceof Error ? error.message : 'Could not update prediction.'}</p> : null}
    {rules ? <div className="sub">How points work for this match:<ul>{rules.map(line => <li key={line}>{line}</li>)}</ul></div> : null}
    {format.bestOf != null ? <p className="sub">Best of {format.bestOf}: the winning side must reach {Math.ceil(format.bestOf / 2)}.</p> : null}
    <div className="grid2">{[teamA, teamB].filter(team => team !== null).map(team => {
      const share = data?.teams.find(row => row.teamId === team.id)
      return <div key={team.id} className="spread">
        <span>{team.name}{mine?.teamId === team.id ? ' · your pick' : ''}</span>
        <b>{share?.percent ?? 0}%</b>
      </div>
    })}</div>
    {!data?.canPredict && data?.isOpen ? <p className="sub">Sign in as an eligible spectator to predict this match.</p> : null}
  </Panel>
}
