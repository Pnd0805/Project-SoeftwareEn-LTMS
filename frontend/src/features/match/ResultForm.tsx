/**
 * src/features/match/ResultForm.tsx
 *
 * The scoresheet a sport actually asks for. Player figures first, and only the
 * team figures no sum of players can produce below them; Chess records neither
 * and the sheet says so. The Decider sits beside the score, never instead of it
 * — 1–1 (4–2 Penalties) is the record, because 2–1 never happened.
 */
import { useState } from 'react'
import { Field, TableWrap } from '../../components/kit/primitives'
import { TeamChip } from '../../components/kit/chips'
import { enterResult, useLtms } from '../../shared/store'
import { team, user } from '../../shared/selectors'
import { deciderName, lineupOf, scoreUnit, statExtra, statLabels, statTeam } from '../../shared/rules'
import type { Match, PlayerStat, Tournament } from '../../shared/types'

type Nums = Record<string, number>
type Texts = Record<string, string>

export function ResultForm({ m, t, by, who }: { m: Match; t: Tournament; by: string; who: string }) {
  const s = useLtms()
  const A = team(s, m.a)!, B = team(s, m.b)!
  const L = statLabels(t.sport)
  const extra = statExtra(t.sport)
  const teamFigures = statTeam(t.sport)

  const [sa, setSa] = useState(0)
  const [sb, setSb] = useState(0)
  const [da, setDa] = useState('')
  const [db, setDb] = useState('')
  const [player, setPlayer] = useState<Nums>({})
  const [teamNums, setTeamNums] = useState<Nums>({})
  const [teamTexts, setTeamTexts] = useState<Texts>({})

  const num = (key: string) => (
    <input type="number" min={0} max={999} style={{ width: 74 }}
      value={player[key] ?? 0} onChange={e => setPlayer(p => ({ ...p, [key]: Number(e.target.value) }))} />
  )

  const submit = () => {
    const stats: Record<string, PlayerStat> = {}
    ;([m.a, m.b].filter(Boolean) as string[]).forEach(tid => {
      lineupOf(s, m, tid).forEach(pid => {
        const g = player[`g-${pid}`] ?? 0
        const a = player[`a-${pid}`] ?? 0
        const x: Record<string, number> = {}
        extra.forEach(([k]) => { x[k] = player[`x-${k}-${pid}`] ?? 0 })
        if (g || a || Object.values(x).some(Boolean)) stats[pid] = { team: tid, goals: g, assists: a, x }
      })
    })
    const teamStats: Match['teamStats'] = {}
    ;([m.a, m.b].filter(Boolean) as string[]).forEach(tid => {
      const row: Record<string, number | string> = {}
      teamFigures.forEach(([k, , kind]) => {
        row[k] = kind === 'text' ? (teamTexts[`${k}-${tid}`] ?? '') : (teamNums[`${k}-${tid}`] ?? 0)
      })
      if (Object.keys(row).length) teamStats[tid] = row
    })
    const decider = da !== '' && db !== ''
      ? { a: Number(da), b: Number(db), kind: deciderName(t.sport) }
      : null
    enterResult(m.id, by, { sa, sb, decider, stats, teamStats })
  }

  return (
    <div className="panel vstack">
      <span className="tag"><em>//</em> {who} — enter the result</span>

      <span className="tag"><em>//</em> {scoreUnit(t.sport)}</span>
      <div className="grid2" style={{ maxWidth: 420 }}>
        <Field label={A.name} htmlFor="sc-a">
          <input id="sc-a" type="number" min={0} max={999} value={sa} onChange={e => setSa(Number(e.target.value))} />
        </Field>
        <Field label={B.name} htmlFor="sc-b">
          <input id="sc-b" type="number" min={0} max={999} value={sb} onChange={e => setSb(Number(e.target.value))} />
        </Field>
      </div>

      <span className="tag">
        <em>//</em> {deciderName(t.sport)} — only if the {scoreUnit(t.sport).toLowerCase()} finish level
      </span>
      <div className="grid2" style={{ maxWidth: 420 }}>
        <Field label={A.name} htmlFor="dc-a">
          <input id="dc-a" type="number" min={0} max={99} placeholder="—" value={da} onChange={e => setDa(e.target.value)} />
        </Field>
        <Field label={B.name} htmlFor="dc-b">
          <input id="dc-b" type="number" min={0} max={99} placeholder="—" value={db} onChange={e => setDb(e.target.value)} />
        </Field>
      </div>

      {L.g ? (
        <>
          <span className="tag">
            <em>//</em> {t.sport} — per player. These feed the top scorers and every profile.
          </span>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Player</th><th>Squad</th><th>{L.g}</th>
                  {L.a ? <th>{L.a}</th> : null}
                  {extra.map(([k, lab]) => <th key={k}>{lab}</th>)}
                </tr>
              </thead>
              <tbody>
                {([m.a, m.b].filter(Boolean) as string[]).flatMap(tid =>
                  lineupOf(s, m, tid).map(pid => (
                    <tr key={pid}>
                      <td>{user(s, pid)?.name ?? '—'}</td>
                      <td><TeamChip id={tid} /></td>
                      <td>{num(`g-${pid}`)}</td>
                      {L.a ? <td>{num(`a-${pid}`)}</td> : null}
                      {extra.map(([k]) => <td key={k}>{num(`x-${k}-${pid}`)}</td>)}
                    </tr>
                  )))}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : null}

      {teamFigures.length ? (
        <>
          <span className="tag"><em>//</em> Per team — only what no player total can produce</span>
          <TableWrap>
            <table>
              <thead><tr><th>Squad</th>{teamFigures.map(([k, lab]) => <th key={k}>{lab}</th>)}</tr></thead>
              <tbody>
                {([m.a, m.b].filter(Boolean) as string[]).map(tid => (
                  <tr key={tid}>
                    <td><TeamChip id={tid} /></td>
                    {teamFigures.map(([k, , kind]) => (
                      <td key={k}>
                        {kind === 'text'
                          ? <input style={{ width: 150 }} placeholder="25-20, 25-18"
                            value={teamTexts[`${k}-${tid}`] ?? ''}
                            onChange={e => setTeamTexts(p => ({ ...p, [`${k}-${tid}`]: e.target.value }))} />
                          : <input type="number" min={0} max={999} style={{ width: 74 }}
                            value={teamNums[`${k}-${tid}`] ?? 0}
                            onChange={e => setTeamNums(p => ({ ...p, [`${k}-${tid}`]: Number(e.target.value) }))} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : null}

      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }} onClick={submit}>
        Submit result
      </button>
    </div>
  )
}
