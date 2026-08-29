/**
 * src/features/match/FixturePage.tsx
 *
 * A fixture is set on its own page: one card with labelled fields (kick-off,
 * venue, map pin, officials), and the same four facts read-only once check-in
 * has started. Appointment to the tournament makes somebody eligible; assignment
 * here makes them responsible, and only an assigned referee may record it.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Crumb, Empty, Facts, Field, Panel, TableWrap, VenueLine } from '../../components/kit/primitives'
import { saveFixture, useLtms } from '../../shared/store'
import { isOrg, match, team, tour, user } from '../../shared/selectors'
import { fmtDate, matchStage, matchTag, parsePin, pinText, refsNeeded } from '../../shared/rules'

/** datetime-local wants a local wall clock, not an ISO instant. */
const toLocal = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function FixturePage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id } = useParams()
  const m = match(s, id)

  const [kickoff, setKickoff] = useState(() => toLocal(m?.kickoff ?? ''))
  const [venue, setVenue] = useState(m?.venue ?? '')
  const [pin, setPin] = useState(pinText(m?.pin))
  const [refs, setRefs] = useState<string[]>(m?.refs ?? [])

  if (!m) return <Empty icon="warn" title="No such match" />
  const t = tour(s, m.tour)!
  const need = refsNeeded(t)
  const pool = (t.referees || []).map(x => user(s, x)).filter(Boolean)
  const open = m.status === 'scheduled' && !m.checkedIn.length
  const A = team(s, m.a), B = team(s, m.b)

  if (!isOrg(s, t)) {
    return (
      <>
        <Crumb back={{ label: t.name, onClick: () => navigate(`/t/${t.id}`) }}>Fixture</Crumb>
        <Empty icon="warn" title="403 — not yours to set"
          sub="Kick-off, venue and officials are the organizer's to place." />
      </>
    )
  }

  const toggle = (uid: string) => setRefs(cur => (cur.includes(uid) ? cur.filter(x => x !== uid) : [...cur, uid]))

  return (
    <>
      <Crumb back={{ label: t.name, onClick: () => navigate(`/t/${t.id}/schedule`) }}>Fixture</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 28 }}>{matchStage(s, m)}</h1>
        {open ? <Badge kind="warn">Open until check-in starts</Badge> : <Badge kind="neutral">Locked — check-in has begun</Badge>}
      </div>

      <Panel quiet>
        <div className="spread">
          <span className="hstack" style={{ gap: 8 }}>
            <span className="badge neutral">{matchTag(s, m)}</span>
            <b>{A && B ? `${A.name} v ${B.name}` : matchStage(s, m)}</b>
          </span>
        </div>

        {open ? (
          <>
            <div className="grid2">
              <Field label="Kick-off" htmlFor={`as-k-${m.id}`}>
                <input id={`as-k-${m.id}`} type="datetime-local" value={kickoff} onChange={e => setKickoff(e.target.value)} />
              </Field>
              <Field label="Venue" htmlFor={`as-v-${m.id}`}>
                <input id={`as-v-${m.id}`} value={venue} onChange={e => setVenue(e.target.value)} placeholder="Court 9" />
              </Field>
            </div>
            <Field label="Map pin" htmlFor={`as-p-${m.id}`}>
              <input id={`as-p-${m.id}`} value={pin} onChange={e => setPin(e.target.value)}
                placeholder="Maps link or 13.7367, 100.5232" />
            </Field>

            <Field label={`Referees — at least ${need}, as many as you like`}>
              <TableWrap>
                <table>
                  <thead><tr><th>On</th><th>Referee</th></tr></thead>
                  <tbody>
                    {pool.map(x => x ? (
                      <tr key={x.id}>
                        <td>
                          <input type="checkbox" checked={refs.includes(x.id)} onChange={() => toggle(x.id)}
                            aria-label={`Put ${x.name} on this match`} />
                        </td>
                        <td>{x.name}</td>
                      </tr>
                    ) : null)}
                  </tbody>
                </table>
              </TableWrap>
              {pool.length < need ? (
                <div className="sub">
                  Only {pool.length} referee{pool.length === 1 ? '' : 's'} accepted so far — appoint more from the Referees tab.
                </div>
              ) : null}
            </Field>

            <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
              onClick={() => { saveFixture(m.id, { kickoff, venue, pin, refs }); navigate(`/t/${t.id}/schedule`) }}>
              Save this fixture
            </button>
            <span className="sub">
              A pin is stored as coordinates and rendered as a link out to Google Maps.
              {parsePin(pin) ? '' : pin ? ' That does not read as a location yet.' : ''}
            </span>
          </>
        ) : (
          <Facts rows={[
            ['Kick-off', fmtDate(m.kickoff)],
            ['Venue', <VenueLine name={m.venue} pin={m.pin ?? t.pin} />],
            ['Map pin', m.pin ? <VenueLine name="Map" pin={m.pin} /> : '—'],
            ['Referees', (m.refs || []).map(r => user(s, r)?.name ?? '—').join(', ') || 'nobody named'],
          ]} />
        )}
      </Panel>
    </>
  )
}
