/**
 * src/features/checkin/CheckinPage.tsx
 *
 * Check-in is self-service, not a referee action: on-site it is signing in plus
 * scanning the organizer's rotating QR, online it is one click. A referee's only
 * lever is after the fact — rejecting a check-in, which is recorded against
 * their name.
 *
 * SRS FR-MM-04: เปิดให้เช็คอินตามช่วงเวลาก่อนแมตช์ บันทึกผลการยืนยันตัวตน
 * และแสดงรายชื่อผู้ที่เช็คอินแล้วให้กรรมการเห็น
 *
 * ── ย้ายมาใช้ API แล้ว ─────────────────────────────────────────────────────
 * รายการเช็คอินมาจาก `match_checkins` ซึ่งเก็บ *เหตุการณ์* — ใครเช็คอิน ด้วยวิธีไหน
 * ผ่านหรือไม่ผ่าน ใครเป็นคนตรวจ ไม่ใช่ array ของ id แบบที่ store เก็บ
 * แปลว่าหน้านี้บอกได้ด้วยว่า "ไม่ผ่านเพราะอะไร" ซึ่งของเดิมบอกไม่ได้
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Field, Panel, Qr, TableWrap } from '../../components/kit/primitives'
import { useMatch, useCheckins, useCheckin, useVerifyCheckin, useUpdateMatch } from '../../hooks/useMatch'
import type { MatchCheckinDto, MatchDto, MatchTeamRef } from '../../types/match.dto'

/** A stable-ish seed so the drawn code looks like the token it stands for. */
const hashCode = (str: string) => {
  let h = 0
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

function SquadPanel({ m, team, checkins }: {
  m: MatchDto; team: MatchTeamRef; checkins: MatchCheckinDto[]
}) {
  const checkin = useCheckin(m.id)
  const verify = useVerifyCheckin(m.id)
  const isRef = m.viewer.can.manageCheckin
  const inCount = team.players.filter(p => checkins.some(c => c.user.id === p.id && c.status === 'success')).length

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tchip"><i style={{ background: team.color ?? 'var(--hairline)' }} /><b>{team.name}</b></span>
        <span className="tag">{inCount} of {team.players.length} in</span>
      </div>
      <TableWrap>
        <table>
          <thead><tr><th>Player</th><th>How</th><th>State</th><th /></tr></thead>
          <tbody>
            {team.players.map(p => {
              const c = checkins.find(x => x.user.id === p.id)
              const isMe = m.viewer.myTeamId === team.id
              return (
                <tr key={p.id}>
                  <td>
                    <span className="hstack">
                      <span className="avatar">{p.fullName.slice(0, 1)}</span>{p.fullName}
                    </span>
                  </td>
                  <td className="sub">
                    {c ? c.method.replace(/_/g, ' ') : '—'}
                    {c?.verifiedByReferee ? <> · checked by {c.verifiedByReferee.fullName}</> : null}
                  </td>
                  <td>
                    {!c ? <Badge kind="warn">Not yet</Badge>
                      : c.status === 'success' ? <Badge kind="ok">Checked in</Badge>
                        : c.status === 'rejected' ? <Badge kind="crit">Rejected</Badge>
                          : <Badge kind="warn">Needs a look</Badge>}
                    {c?.rejectionReason ? <span className="sub"> {c.rejectionReason}</span> : null}
                  </td>
                  <td>
                    {!c && isMe ? (
                      <button className="btn primary" type="button" disabled={checkin.isPending}
                        onClick={() => checkin.mutate({
                          method: m.mode === 'onsite' ? 'qr_onsite' : 'photo_online',
                          userId: p.id,
                          ...(m.mode === 'onsite' && m.checkinToken ? { qrToken: m.checkinToken } : {}),
                        })}>
                        {m.mode === 'onsite' ? 'Scan the QR' : 'Check in'}
                      </button>
                    ) : c && c.status !== 'rejected' && isRef ? (
                      <button className="btn danger" type="button" disabled={verify.isPending}
                        onClick={() => verify.mutate({
                          userId: p.id,
                          input: { status: 'rejected', rejectionReason: 'Rejected by the referee' },
                        })}>
                        Reject
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>
      {/* TODO(schema): starter / substitute อยู่ที่ team_members.position (ระดับทีม,
          FR-TM-04, สไลซ์ 4) ไม่ใช่ระดับแมตช์ — คอลัมน์นั้นจึงยังไม่มีที่นี่ */}
    </Panel>
  )
}

export function CheckinPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const matchId = Number(id)
  const validId = Number.isFinite(matchId)

  const { data: m, isPending, isError } = useMatch(validId ? matchId : undefined)
  const { data: checkinData } = useCheckins(validId ? matchId : undefined)
  const update = useUpdateMatch(matchId, m?.tournamentId)
  const [room, setRoom] = useState('')

  if (!validId || isError) return <Empty icon="warn" title="No such match" />
  if (isPending) return <Panel quiet><span className="sub">Loading check-in…</span></Panel>

  const checkins = checkinData?.items ?? []
  const squads = [m.teamA, m.teamB].filter(Boolean) as MatchTeamRef[]
  const total = squads.reduce((n, t) => n + t.players.length, 0)
  const done = checkins.filter(c => c.status === 'success').length
  const isRef = m.viewer.can.manageCheckin
  const everyoneIn = total > 0 && done >= total

  return (
    <>
      <Crumb back={{ label: 'Match', onClick: () => navigate(`/m/${m.id}`) }}>Check-in</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 28 }}>Check in</h1>
        <Badge kind="warn">{m.mode === 'onsite' ? 'On-site' : 'Online'}</Badge>
      </div>

      {isRef && m.mode === 'onsite' && m.checkinToken ? (
        <Panel>
          <div className="spread"><span className="tag"><em>//</em> Show this at the referee's table</span></div>
          <div className="hstack" style={{ alignItems: 'flex-start', gap: 22 }}>
            <span className="qr"><Qr size={19} seed={hashCode(m.checkinToken)} /></span>
            <span className="vstack" style={{ gap: 10, flex: 1, minWidth: 220 }}>
              <div className="statline">
                <div>
                  <span className="tag">Code</span>
                  <span className="v" style={{ fontFamily: 'var(--f-mono)', fontSize: 24, letterSpacing: '.09em' }}>
                    {m.checkinToken}
                  </span>
                </div>
                <div>
                  <span className="tag">Verified</span>
                  <span className="v" style={{ fontFamily: 'var(--f-mono)', fontSize: 24 }}>{done} / {total}</span>
                </div>
              </div>
              <span className="tag"><em>//</em> Rotates every 60s — a screenshot is worthless a minute later</span>
            </span>
          </div>
        </Panel>
      ) : null}

      {isRef && m.mode === 'online' ? (
        <Panel>
          <div className="spread">
            <span className="tag"><em>//</em> Verified</span>
            <span className="v" style={{ fontFamily: 'var(--f-mono)', fontSize: 24 }}>{done} / {total}</span>
          </div>
          <Field
            label="Room code — from the game client, once the lobby exists. Optional; shown to both squads once saved."
            htmlFor={`rc-${m.id}`}>
            <div className="hstack">
              <input id={`rc-${m.id}`} value={room || m.roomCode || ''} onChange={e => setRoom(e.target.value)}
                placeholder="e.g. a ROV custom-room number" style={{ flex: 1 }} />
              <button className="btn" type="button" disabled={update.isPending}
                onClick={() => update.mutate({ roomCode: room })}>
                {update.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </Field>
        </Panel>
      ) : null}

      {!isRef && m.mode === 'online' && m.roomCode ? (
        <Banner kind="ok" icon="check">
          <b>Room code</b>{' '}
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 16, letterSpacing: '.05em' }}>{m.roomCode}</span>
        </Banner>
      ) : null}

      {squads.map(t => <SquadPanel key={t.id} m={m} team={t} checkins={checkins} />)}

      {everyoneIn ? (
        <Panel>
          <Banner kind="ok" icon="check"><b>Everyone is through.</b> Check-in is finished for this match.</Banner>
          {m.viewer.can.submitResult ? (
            <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
              onClick={() => navigate(`/m/${m.id}`)}>Record the result</button>
          ) : null}
        </Panel>
      ) : null}
    </>
  )
}
