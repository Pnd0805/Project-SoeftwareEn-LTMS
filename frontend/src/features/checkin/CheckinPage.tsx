/**
 * src/features/checkin/CheckinPage.tsx
 *
 * Check-in is self-service, not a referee action: on-site it is signing in plus
 * scanning the organizer's rotating QR, online it is one click. A referee's only
 * lever is after the fact — marking a checked-in player ineligible, which is
 * reported to the organizer. Check-in applies to the Lineup, not the whole team.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Field, Panel, Qr, TableWrap } from '../../components/kit/primitives'
import { checkIn, markIneligible, setRoomCode, useLtms } from '../../shared/store'
import { match, me, team, tour, user } from '../../shared/selectors'
import { allCheckedIn, lineupOf, qrToken, startersOf } from '../../shared/rules'

/** A stable-ish seed so the drawn code looks like the token it stands for. */
const hashCode = (str: string) => {
  let h = 0
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export function CheckinPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id } = useParams()
  const m = match(s, id)
  const u = me(s)
  const [room, setRoom] = useState(m?.roomCode ?? '')

  if (!m) return <Empty icon="warn" title="No such match" />
  const t = tour(s, m.tour)!
  const isReferee = !!u && (m.refs || []).includes(u.id)
  const squads = [m.a, m.b].filter(Boolean).map(x => team(s, x)!).filter(Boolean)
  const total = squads.reduce((n, sq) => n + lineupOf(s, m, sq.id).length, 0)

  return (
    <>
      <Crumb back={{ label: 'Match', onClick: () => navigate(`/m/${m.id}`) }}>Check-in</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 28 }}>Check in</h1>
        <Badge kind="warn">{t.channel === 'onsite' ? 'On-site' : 'Online'}</Badge>
      </div>

      {isReferee && t.channel === 'onsite' ? (
        <Panel>
          <div className="spread"><span className="tag"><em>//</em> Show this at the referee's table</span></div>
          <div className="hstack" style={{ alignItems: 'flex-start', gap: 22 }}>
            <span className="qr"><Qr size={19} seed={hashCode(qrToken(m.id))} /></span>
            <span className="vstack" style={{ gap: 10, flex: 1, minWidth: 220 }}>
              <div className="statline">
                <div>
                  <span className="tag">Code</span>
                  <span className="v" style={{ fontFamily: 'var(--f-mono)', fontSize: 24, letterSpacing: '.09em' }}>{qrToken(m.id)}</span>
                </div>
                <div>
                  <span className="tag">Verified</span>
                  <span className="v" style={{ fontFamily: 'var(--f-mono)', fontSize: 24 }}>{m.checkedIn.length} / {total}</span>
                </div>
              </div>
              <span className="tag"><em>//</em> Rotates every 60s — a screenshot is worthless a minute later</span>
            </span>
          </div>
        </Panel>
      ) : null}

      {isReferee && t.channel === 'online' ? (
        <Panel>
          <div className="spread">
            <span className="tag"><em>//</em> Verified</span>
            <span className="v" style={{ fontFamily: 'var(--f-mono)', fontSize: 24 }}>{m.checkedIn.length} / {total}</span>
          </div>
          <Field
            label="Room code — from the game client, once the lobby exists. Optional; shown to both squads once saved."
            htmlFor={`rc-${m.id}`}>
            <div className="hstack">
              <input id={`rc-${m.id}`} value={room} onChange={e => setRoom(e.target.value)}
                placeholder="e.g. a ROV custom-room number" style={{ flex: 1 }} />
              <button className="btn" type="button" onClick={() => setRoomCode(m.id, room)}>Save</button>
            </div>
          </Field>
        </Panel>
      ) : null}

      {!isReferee && t.channel === 'online' && m.roomCode ? (
        <Banner kind="ok" icon="check">
          <b>Room code</b>{' '}
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 16, letterSpacing: '.05em' }}>{m.roomCode}</span>
        </Banner>
      ) : null}

      {squads.map(sq => {
        const named = lineupOf(s, m, sq.id)
        const starters = startersOf(s, m, sq.id)
        return (
          <Panel quiet key={sq.id}>
            <div className="spread">
              <span className="tchip"><i style={{ background: sq.color }} /><b>{sq.name}</b></span>
              <span className="tag">{named.filter(x => m.checkedIn.includes(x)).length} of {named.length} in</span>
            </div>
            <TableWrap>
              <table>
                <thead><tr><th>Player</th><th>Faculty</th><th>State</th><th /></tr></thead>
                <tbody>
                  {named.map(pid => {
                    const p = user(s, pid)
                    if (!p) return null
                    const inn = m.checkedIn.includes(pid)
                    const isMe = u?.id === pid
                    const role = starters.includes(pid) ? 'Starter' : 'Substitute'
                    return (
                      <tr key={pid}>
                        <td>
                          <span className="hstack">
                            <span className="avatar">{p.name.slice(0, 1)}</span>{p.name}
                            {isMe ? <span className="tag"> · you</span> : null}
                          </span>
                        </td>
                        <td className="sub">{p.faculty} · Year {p.year} · {role}</td>
                        <td>{inn ? <Badge kind="ok">Checked in</Badge> : <Badge kind="warn">Not yet</Badge>}</td>
                        <td>
                          {!inn && isMe ? (
                            <button className="btn primary" type="button" onClick={() => checkIn(m.id, pid)}>
                              {t.channel === 'onsite' ? 'Scan the QR' : 'Check in'}
                            </button>
                          ) : inn && isReferee ? (
                            <button className="btn danger" type="button" onClick={() => markIneligible(m.id, pid, u!.id)}>
                              Mark ineligible
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )
      })}

      {allCheckedIn(s, m) && m.status === 'scheduled' ? (
        <Panel>
          <Banner kind="ok" icon="check"><b>Everyone is through.</b> Check-in is finished for this match.</Banner>
          {isReferee ? (
            <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
              onClick={() => navigate(`/m/${m.id}`)}>Record the result</button>
          ) : null}
        </Panel>
      ) : null}
    </>
  )
}
