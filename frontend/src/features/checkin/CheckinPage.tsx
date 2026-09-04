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
import { TeamMarkView } from '../../components/kit/chips'
import { IdPhotoModal, ManualVerifyModal, QrScanModal, ReviewPhotoModal } from './CaptureModals'
import { toTeamView } from '../match/matchView'

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

  /** ผู้เล่นที่กำลังยืนยันตัวตนอยู่ · null = ไม่ได้เปิดโมดัล */
  const [capture, setCapture] = useState<number | null>(null)
  /** รูปที่กรรมการกำลังตรวจ */
  const [review, setReview] = useState<{ userId: number; name: string; photo: string | null } | null>(null)
  /** UC-04 E2b — กรรมการยืนยันแทนเมื่อกล้องใช้ไม่ได้ */
  const [manual, setManual] = useState<{ userId: number; name: string } | null>(null)

  const closeCapture = () => setCapture(null)

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tchip"><TeamMarkView team={toTeamView(team)} /><b>{team.name}</b></span>
        <span className="tag">{inCount} of {team.players.length} in</span>
      </div>
      <TableWrap>
        <table>
          <thead><tr><th>Player</th><th>How</th><th>State</th><th /></tr></thead>
          <tbody>
            {team.players.map(p => {
              const c = checkins.find(x => x.user.id === p.id)
              /* UC-04 บังคับว่าเป็นตัวเองเท่านั้น — on-site "สแกนขณะเข้าสู่ระบบด้วย
                 บัญชีตนเอง" · online "ถ่ายภาพตนเองคู่บัตร" เทียบที่ผู้ใช้ ไม่ใช่ที่ทีม
                 (เดิมเทียบ myTeamId === team.id ซึ่งแปลว่าใครก็ได้ในทีมทำแทนกันได้)

                 ใช้ `viewer.myUserId` ที่ server บอกมา ไม่ใช่ id จาก useMe() เพราะ
                 บัญชีเดโมกับรายชื่อผู้เล่นมาคนละชุด id */
              const isMe = m.viewer.myUserId !== null && p.id === m.viewer.myUserId
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
                    {(!c || c.status === 'rejected') && isMe ? (
                      /* ยืนยันตัวตนก่อนเสมอ — on-site สแกน QR · online ถ่ายรูปคู่บัตร */
                      <button className="btn primary" type="button" disabled={checkin.isPending}
                        onClick={() => setCapture(p.id)}>
                        {m.mode === 'onsite' ? 'Scan the QR' : 'Take the photo'}
                      </button>
                    ) : c && c.status === 'exception' && isRef ? (
                      /* รูปที่รอตรวจ — กรรมการเปิดดูแล้วตัดสิน (FR-PV-04) */
                      <button className="btn primary" type="button"
                        onClick={() => setReview({ userId: p.id, name: p.fullName, photo: c.documentS3Key })}>
                        Review photo
                      </button>
                    ) : !c && isRef ? (
                      /* UC-04 E2b — ไม่มีกล้องหรือสัญญาณขัดข้อง กรรมการยืนยันเองแล้ว
                         บันทึกเป็นข้อยกเว้นพร้อมเหตุผล */
                      <button className="btn ghost" type="button"
                        onClick={() => setManual({ userId: p.id, name: p.fullName })}>
                        Verify by hand
                      </button>
                    ) : c && c.status === 'success' && isRef ? (
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

      <QrScanModal
        open={capture !== null && m.mode === 'onsite'}
        onClose={closeCapture}
        expectedToken={m.checkinToken}
        pending={checkin.isPending}
        onScanned={token => {
          if (capture === null) return
          checkin.mutate(
            { method: 'qr_onsite', userId: capture, qrToken: token },
            { onSuccess: closeCapture },
          )
        }}
      />

      <IdPhotoModal
        open={capture !== null && m.mode === 'online'}
        onClose={closeCapture}
        pending={checkin.isPending}
        onSubmit={({ photo, documentType }) => {
          if (capture === null) return
          checkin.mutate(
            { method: 'photo_online', userId: capture, documentType, documentS3Key: photo },
            { onSuccess: closeCapture },
          )
        }}
      />

      <ManualVerifyModal
        open={!!manual}
        onClose={() => setManual(null)}
        playerName={manual?.name ?? ''}
        pending={checkin.isPending}
        onConfirm={(reason: string) => {
          if (!manual) return
          /* เหตุผลถูกเก็บเป็นหลักฐานแทนภาพ — ช่องเดียวกับที่ปกติเก็บรูป */
          checkin.mutate(
            { method: 'manual_by_referee', userId: manual.userId, documentS3Key: reason },
            { onSuccess: () => setManual(null) },
          )
        }}
      />

      <ReviewPhotoModal
        open={!!review}
        onClose={() => setReview(null)}
        playerName={review?.name ?? ''}
        photo={review?.photo ?? null}
        pending={verify.isPending}
        onDecide={(approve, reason) => {
          if (!review) return
          verify.mutate(
            {
              userId: review.userId,
              input: approve
                ? { status: 'success' }
                : { status: 'rejected', rejectionReason: reason ?? 'ไม่ผ่านการตรวจ' },
            },
            { onSuccess: () => setReview(null) },
          )
        }}
      />
    </Panel>
  )
}

export function CheckinPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const matchId = id
  const { data: m, isPending, isError } = useMatch(matchId)
  const { data: checkinData } = useCheckins(matchId)
  const update = useUpdateMatch(matchId ?? 0, m?.tournamentId)
  const [room, setRoom] = useState('')

  if (!matchId || isError) return <Empty icon="warn" title="No such match" />
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
