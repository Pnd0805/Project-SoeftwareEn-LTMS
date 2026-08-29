/**
 * src/features/match/LineupPanel.tsx
 *
 * The team sheet, for the leader of a squad in this match. Three states per
 * player and nothing else — starting, on the bench, or not in this one. A team
 * with no Lineup fields its starters from the previous match: the leader is
 * never blocked from playing by paperwork.
 */
import { useState } from 'react'
import { Badge, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamChip } from '../../components/kit/chips'
import { saveLineup, useLtms } from '../../shared/store'
import { me, team, user } from '../../shared/selectors'
import { startersOf } from '../../shared/rules'
import type { Match } from '../../shared/types'

type Role = 'start' | 'sub' | 'out'
const ROLES: [Role, string][] = [['start', 'Starting'], ['sub', 'Substitute'], ['out', 'Not in this match']]

/** The same thing as a fact, for everybody else. */
function LineupRead({ m }: { m: Match }) {
  const s = useLtms()
  const named = m.lineup || {}
  const sides = [m.a, m.b].filter(x => x && named[x]?.starters?.length) as string[]
  if (!sides.length) return null
  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Lineups</span>
      <div className="grid2">
        {sides.map(tid => (
          <div className="vstack" style={{ gap: 6 }} key={tid}>
            <TeamChip id={tid} />
            <span className="sub">Starting: {named[tid].starters.map(id => user(s, id)?.name ?? '—').join(', ')}</span>
            {named[tid].subs?.length
              ? <span className="sub">Bench: {named[tid].subs.map(id => user(s, id)?.name ?? '—').join(', ')}</span>
              : null}
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function LineupPanel({ m }: { m: Match }) {
  const s = useLtms()
  const u = me(s)
  const tid = [m.a, m.b].filter(Boolean).find(x => team(s, x)?.leader === u?.id) ?? null
  const tm = team(s, tid)
  const named = tid ? (m.lineup || {})[tid] : undefined
  const starters = tid ? startersOf(s, m, tid) : []
  const subs = named?.subs ?? []

  const [roles, setRoles] = useState<Record<string, Role>>(() => {
    const out: Record<string, Role> = {}
    tm?.members.forEach(id => {
      out[id] = starters.includes(id) ? 'start' : subs.includes(id) ? 'sub' : named ? 'out' : 'start'
    })
    return out
  })

  if (!u || m.status !== 'scheduled' || !tm || !tid) return <LineupRead m={m} />

  const save = () => saveLineup(
    m.id, tid,
    tm.members.filter(id => roles[id] === 'start'),
    tm.members.filter(id => roles[id] === 'sub'),
  )

  return (
    <Panel>
      <div className="spread">
        <span className="tag"><em>//</em> Your lineup for {tm.name}</span>
        {named ? <Badge kind="ok">Named</Badge> : <Badge kind="warn">Not named — last match's starters play</Badge>}
      </div>
      <TableWrap>
        <table>
          <thead><tr><th>Player</th><th>Faculty</th><th>In this match</th></tr></thead>
          <tbody>
            {tm.members.map(id => {
              const p = user(s, id)
              if (!p) return null
              return (
                <tr key={id}>
                  <td>{p.name}{tm.leader === id ? <span className="tag"> · leader</span> : null}</td>
                  <td className="sub">{p.faculty} · Year {p.year}</td>
                  <td>
                    <select value={roles[id]} aria-label={`Role for ${p.name}`}
                      onChange={e => setRoles(r => ({ ...r, [id]: e.target.value as Role }))}>
                      {ROLES.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>
      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }} onClick={save}>
        Save the lineup
      </button>
    </Panel>
  )
}
