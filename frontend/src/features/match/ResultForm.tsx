/**
 * src/features/match/ResultForm.tsx
 *
 * The scoresheet a sport actually asks for. The Decider sits beside the score,
 * never instead of it — 1–1 (4–2 Penalties) is the record, because 2–1 never
 * happened.
 *
 * SRS FR-RS-01: บันทึกคะแนน ผู้ชนะ และสถิติรายบุคคลตามประเภทกีฬา
 *
 * ── ย้ายมาใช้ API แล้ว ─────────────────────────────────────────────────────
 * ช่องสถิติมาจาก `sport_stat_definitions` ผ่าน `useStatDefinitions()` ไม่ใช่
 * `statLabels(t.sport)` ที่ hardcode ตามชื่อกีฬาใน rules.ts อีกต่อไป — เพิ่มกีฬา
 * ใหม่แล้วฟอร์มขึ้นเองโดยไม่ต้องแก้โค้ด ซึ่งเป็นเหตุผลที่ตารางนั้นมีอยู่
 *
 * S01 เป็น idempotent อยู่แล้ว (match_results.match_id เป็น UNIQUE) กดซ้ำจึง
 * UPDATE แถวเดิม ไม่สร้างซ้ำ — ปุ่มไม่ต้องกันการกดซ้ำเอง
 */
import { useState } from 'react'
import { Banner, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamChipView } from '../../components/kit/chips'
import { useStatDefinitions, useSubmitResult, useSaveMatchStats } from '../../hooks/useMatch'
import { toTeamView } from './matchView'
import type { MatchDto, MatchTeamRef } from '../../types/match.dto'

type Nums = Record<string, number>

export function ResultForm({ m }: { m: MatchDto }) {
  const { data: defs } = useStatDefinitions(m.tournament.sportTypeId)
  const submit = useSubmitResult(m.id, m.tournamentId)
  const saveStats = useSaveMatchStats(m.id)

  const [sa, setSa] = useState(0)
  const [sb, setSb] = useState(0)
  const [da, setDa] = useState('')
  const [db, setDb] = useState('')
  const [stat, setStat] = useState<Nums>({})

  const sides = [m.teamA, m.teamB].filter(Boolean) as MatchTeamRef[]
  const statDefs = defs?.items ?? []
  const level = sa === sb
  const deciderGiven = da !== '' && db !== ''

  const key = (playerId: number, statKey: string) => `${playerId}:${statKey}`
  const num = (playerId: number, statKey: string) => (
    <input type="number" min={0} max={999} style={{ width: 74 }}
      value={stat[key(playerId, statKey)] ?? 0}
      onChange={e => setStat(p => ({ ...p, [key(playerId, statKey)]: Number(e.target.value) }))} />
  )

  const winnerTeamId = () => {
    if (!level) return sa > sb ? m.teamA?.id ?? null : m.teamB?.id ?? null
    if (!deciderGiven) return null
    return Number(da) > Number(db) ? m.teamA?.id ?? null : m.teamB?.id ?? null
  }

  const onSubmit = async () => {
    await submit.mutateAsync({
      winnerTeamId: winnerTeamId(),
      scoreData: {
        a: sa,
        b: sb,
        ...(deciderGiven ? { decider: { a: Number(da), b: Number(db), kind: 'Decider' } } : {}),
      },
    })
    /* สถิติเป็นคนละตาราง (player_match_stats) จึงเป็นคนละ request
       ส่งเฉพาะคนที่มีตัวเลขจริง — แถวศูนย์ล้วนไม่ต้องเก็บ */
    if (m.viewer.can.recordStats && statDefs.length) {
      const entries = sides.flatMap(t => t.players.map(p => {
        const values: Record<string, number> = {}
        statDefs.forEach(d => { values[d.statKey] = stat[key(p.id, d.statKey)] ?? 0 })
        return { userId: p.id, teamId: t.id, values }
      })).filter(e => Object.values(e.values).some(Boolean))
      if (entries.length) await saveStats.mutateAsync({ entries })
    }
  }

  /* ผลเสมอที่ไม่มีตัวตัดสิน = ไม่มีผู้ชนะ ซึ่ง bracket เดินต่อไม่ได้
     Round Robin เสมอได้ แต่สายแพ้คัดออกไม่ได้ — กันไว้ตรงที่คนกรอกเห็น */
  const blocked = level && !deciderGiven && !!m.nextMatchId

  return (
    <Panel>
      <span className="tag">
        <em>//</em> {m.mode === 'onsite' ? 'Referee' : 'Winning team leader'} — enter the result
      </span>

      <div className="grid2" style={{ maxWidth: 420 }}>
        <Field label={m.teamA?.name ?? 'Home'} htmlFor="sc-a">
          <input id="sc-a" type="number" min={0} max={999} value={sa} onChange={e => setSa(Number(e.target.value))} />
        </Field>
        <Field label={m.teamB?.name ?? 'Away'} htmlFor="sc-b">
          <input id="sc-b" type="number" min={0} max={999} value={sb} onChange={e => setSb(Number(e.target.value))} />
        </Field>
      </div>

      <span className="tag"><em>//</em> Decider — only if the score finishes level</span>
      <div className="grid2" style={{ maxWidth: 420 }}>
        <Field label={m.teamA?.name ?? 'Home'} htmlFor="dc-a">
          <input id="dc-a" type="number" min={0} max={99} placeholder="—" value={da} onChange={e => setDa(e.target.value)} />
        </Field>
        <Field label={m.teamB?.name ?? 'Away'} htmlFor="dc-b">
          <input id="dc-b" type="number" min={0} max={99} placeholder="—" value={db} onChange={e => setDb(e.target.value)} />
        </Field>
      </div>

      {blocked ? (
        <Banner kind="warn">
          <b>Level, and this match feeds another one.</b> Record the decider so the bracket knows who
          advances.
        </Banner>
      ) : null}

      {m.viewer.can.recordStats && statDefs.length ? (
        <>
          <span className="tag">
            <em>//</em> {m.tournament.sportName} — per player. These feed the top scorers and every profile.
          </span>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Player</th><th>Squad</th>
                  {statDefs.map(d => <th key={d.statKey}>{d.statLabelTh}</th>)}
                </tr>
              </thead>
              <tbody>
                {sides.flatMap(t => t.players.map(p => (
                  <tr key={`${t.id}-${p.id}`}>
                    <td>{p.fullName}</td>
                    <td><TeamChipView team={toTeamView(t)} /></td>
                    {statDefs.map(d => <td key={d.statKey}>{num(p.id, d.statKey)}</td>)}
                  </tr>
                )))}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : null}

      {submit.isError ? (
        <Banner kind="crit">
          Could not save the result.{' '}
          {submit.error instanceof Error ? submit.error.message : 'Try again.'}
        </Banner>
      ) : null}

      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
        disabled={submit.isPending || saveStats.isPending || blocked}
        onClick={onSubmit}>
        {submit.isPending || saveStats.isPending ? 'Saving…' : 'Submit result'}
      </button>
    </Panel>
  )
}
