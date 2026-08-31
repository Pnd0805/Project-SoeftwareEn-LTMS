/**
 * src/features/match/FixturePage.tsx
 *
 * A fixture is set on its own page: one card with labelled fields (kick-off,
 * venue, officials), and the same facts read-only once check-in has started.
 * Appointment to the tournament makes somebody eligible; assignment here makes
 * them responsible, and only an assigned referee may record the result.
 *
 * SRS FR-MM-02: จัดวันเวลาและสนามให้แต่ละแมตช์
 *
 * ⚠️ FR-MM-02 ยังสั่งให้ระบบ **ตรวจไม่ให้ทีมเดียวกันมีนัดเวลาทับซ้อน และไม่ให้
 *    สนามเดียวกันถูกใช้ซ้อนเวลา** ซึ่งต้องรู้ตารางทั้งทัวร์นาเมนต์ — เป็นการตรวจ
 *    ฝั่ง server ที่ยังไม่มี endpoint รองรับ หน้านี้จึงยังบันทึกทับกันได้อยู่
 *    เป็นช่องว่างจริง ไม่ใช่เรื่องที่ลืม
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Facts, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { useMatch, useUpdateMatch, useAssignReferees } from '../../hooks/useMatch'

/** datetime-local wants a local wall clock, not an ISO instant. */
const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function FixturePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const matchId = Number(id)
  const validId = Number.isFinite(matchId)

  const { data: m, isPending, isError } = useMatch(validId ? matchId : undefined)
  const update = useUpdateMatch(matchId, m?.tournamentId)
  const assign = useAssignReferees(matchId, m?.tournamentId)

  const [kickoff, setKickoff] = useState<string | null>(null)
  const [venue, setVenue] = useState<string | null>(null)
  const [refs, setRefs] = useState<number[] | null>(null)

  if (!validId || isError) return <Empty icon="warn" title="No such match" />
  if (isPending) return <Panel quiet><span className="sub">Loading the fixture…</span></Panel>

  /* ค่าที่แก้อยู่ยังไม่ commit — ยังไม่แตะช่องไหนก็ใช้ค่าจาก server */
  const kickoffVal = kickoff ?? toLocal(m.scheduledTime)
  const venueVal = venue ?? (m.venue ?? '')
  const refsVal = refs ?? m.referees.map(r => r.id)

  if (!m.viewer.can.editFixture) {
    return (
      <>
        <Crumb back={{ label: m.tournament.name, onClick: () => navigate(`/t/${m.tournament.id}`) }}>Fixture</Crumb>
        <Empty icon="warn" title="403 — not yours to set"
          sub="Kick-off, venue and officials are the organizer's to place." />
      </>
    )
  }

  const open = m.checkedIn === 0
  const toggle = (uid: number) =>
    setRefs(cur => {
      const now = cur ?? m.referees.map(r => r.id)
      return now.includes(uid) ? now.filter(x => x !== uid) : [...now, uid]
    })

  const save = async () => {
    await update.mutateAsync({
      scheduledTime: kickoffVal ? new Date(kickoffVal).toISOString() : null,
      venue: venueVal || null,
    })
    await assign.mutateAsync(refsVal)
    navigate(`/t/${m.tournament.id}/schedule`)
  }

  const saving = update.isPending || assign.isPending

  return (
    <>
      <Crumb back={{ label: m.tournament.name, onClick: () => navigate(`/t/${m.tournament.id}/schedule`) }}>Fixture</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 28 }}>{m.stage}</h1>
        {open
          ? <Badge kind="warn">Open until check-in starts</Badge>
          : <Badge kind="neutral">Locked — check-in has begun</Badge>}
      </div>

      <Panel quiet>
        <div className="spread">
          <span className="hstack" style={{ gap: 8 }}>
            <span className="badge neutral">{m.tag}</span>
            <b>{m.teamA && m.teamB ? `${m.teamA.name} v ${m.teamB.name}` : m.stage}</b>
          </span>
        </div>

        {open ? (
          <>
            <div className="grid2">
              <Field label="Kick-off" htmlFor={`as-k-${m.id}`}>
                <input id={`as-k-${m.id}`} type="datetime-local" value={kickoffVal}
                  onChange={e => setKickoff(e.target.value)} />
              </Field>
              <Field label="Venue" htmlFor={`as-v-${m.id}`}>
                <input id={`as-v-${m.id}`} value={venueVal} onChange={e => setVenue(e.target.value)}
                  placeholder="Court 9" />
              </Field>
            </div>

            {/* TODO(schema): FR-MM-05 อยากให้ผู้เล่นหาสนามเจอ แต่ `matches` ไม่มีคอลัมน์พิกัด
                ช่อง Map pin ของ prototype จึงยังไม่มีที่เก็บ */}

            <Field label="Referees — appointment makes them eligible, this makes them responsible">
              <TableWrap>
                <table>
                  <thead><tr><th>On</th><th>Referee</th></tr></thead>
                  <tbody>
                    {m.availableReferees.map(r => (
                      <tr key={r.id}>
                        <td>
                          <input type="checkbox" checked={refsVal.includes(r.id)} onChange={() => toggle(r.id)}
                            aria-label={`Put ${r.fullName} on this match`} />
                        </td>
                        <td>{r.fullName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              {!m.availableReferees.length ? (
                <div className="sub">
                  Nobody has accepted an appointment to this tournament yet — invite them from the
                  Referees tab first.
                </div>
              ) : null}
            </Field>

            {update.isError || assign.isError ? (
              <Banner kind="crit">Could not save the fixture. Nothing was changed.</Banner>
            ) : null}

            <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
              disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save this fixture'}
            </button>
          </>
        ) : (
          <Facts rows={[
            ['Kick-off', m.scheduledTime ? new Date(m.scheduledTime).toLocaleString() : '—'],
            ['Venue', m.venue || '—'],
            ['Referees', m.referees.map(r => r.fullName).join(', ') || 'nobody named'],
          ]} />
        )}
      </Panel>
    </>
  )
}
