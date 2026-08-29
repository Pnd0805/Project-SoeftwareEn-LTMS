/**
 * src/features/tournament/manage/RefereePanel.tsx
 *
 * Officiating is not a role and not a granted right — any student can be asked.
 * That makes the candidate list the whole roll, so it is searched, never
 * scrolled: the panel states how the tournament stands, and the modal is where
 * that standing gets changed.
 */
import { useState } from 'react'
import { Badge, Banner, Field, Panel, TableWrap } from '../../../components/kit/primitives'
import { Modal } from '../../../components/kit/Modal'
import { appointReferee, removeReferee, useLtms } from '../../../shared/store'
import { user } from '../../../shared/selectors'
import type { Tournament } from '../../../shared/types'

export function RefereeFinder({ t, open, onClose }: { t: Tournament; open: boolean; onClose: () => void }) {
  const s = useLtms()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const cands = s.users
    .filter(x => x.role !== 'Admin' && !(t.referees || []).includes(x.id))
    .filter(x => needle.length > 1 && x.name.toLowerCase().includes(needle))
    .slice(0, 12)

  return (
    <Modal open={open} onClose={onClose}
      label={`Appoint a referee — an ${t.channel} match needs ${t.channel === 'onsite' ? 2 : 1}`}
      title={t.name}>
      <Field label="Search the roll by name" htmlFor="ref-find">
        <input id="ref-find" autoComplete="off" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Start typing a name…" />
      </Field>
      {cands.length ? (
        <TableWrap>
          <table>
            <tbody>
              {cands.map(x => (
                <tr key={x.id}>
                  <td><span className="hstack"><span className="avatar">{x.name.slice(0, 1)}</span>{x.name}</span></td>
                  <td className="sub">{x.faculty} · Year {x.year}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn primary" type="button" onClick={() => appointReferee(t.id, x.id)}>
                      Invite to officiate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <div className="sub">
          {needle.length > 1 ? 'Nobody on the roll matches that.' : 'Type at least two letters — the roll is the whole university.'}
        </div>
      )}
      <div className="hstack"><button className="btn ghost" type="button" onClick={onClose}>Done</button></div>
    </Modal>
  )
}

export function RefereePanel({ t, need, onAppoint }: { t: Tournament; need: number; onAppoint: () => void }) {
  const s = useLtms()
  const accepted = t.referees || []
  const pending = s.refInvites.filter(i => i.tour === t.id && i.status === 'pending')
  const onIt = [
    ...accepted.map(id => ({ u: user(s, id), state: 'accepted' as const })),
    ...pending.map(i => ({ u: user(s, i.user), state: 'pending' as const })),
  ].filter(x => x.u)

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Referees — an {t.channel} match needs {need}</span>
        <Badge kind={accepted.length >= need ? 'ok' : 'warn'}>{`${accepted.length} of ${need} accepted`}</Badge>
      </div>

      {accepted.length < need ? (
        <Banner kind="warn">
          <b>{need - accepted.length} more must accept before this can be published.</b>{' '}
          An invitation counts only once it is answered.
        </Banner>
      ) : null}

      {onIt.length ? (
        <TableWrap>
          <table>
            <thead><tr><th>On this tournament</th><th>Faculty</th><th>State</th><th /></tr></thead>
            <tbody>
              {onIt.map(({ u, state }) => u ? (
                <tr key={u.id + state}>
                  <td><span className="hstack"><span className="avatar">{u.name.slice(0, 1)}</span>{u.name}</span></td>
                  <td className="sub">{u.faculty} · Year {u.year}</td>
                  <td>{state === 'accepted' ? <Badge kind="ok">Accepted</Badge> : <Badge kind="warn">Invited — waiting</Badge>}</td>
                  <td><button className="btn ghost" type="button" onClick={() => removeReferee(t.id, u.id)}>Remove</button></td>
                </tr>
              ) : null)}
            </tbody>
          </table>
        </TableWrap>
      ) : null}

      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }} onClick={onAppoint}>
        Appoint a referee
      </button>
    </Panel>
  )
}
