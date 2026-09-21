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
import { useMatch, useCheckins, useCheckin, useMyCheckin, useVerifyCheckin, useUpdateMatch } from '../../hooks/useMatch'
import { USE_MOCK } from '../../api/client'
import type { MatchCheckinDto, MatchDto, MatchTeamRef } from '../../types/match.dto'
import { TeamMarkView } from '../../components/kit/chips'
import { IdPhotoModal, ManualVerifyModal, QrScanModal, ReviewPhotoModal } from './CaptureModals'
import { toTeamView } from '../match/matchView'
import { checkinErrorMessage } from './checkinErrors'

/** M15 revokes accepted QR/manual check-ins as well as pending photo checks. */
const canRevoke = (c: MatchCheckinDto) => c.status === 'success'

/** A stable-ish seed so the drawn code looks like the token it stands for. */
const hashCode = (str: string) => {
  let h = 0
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

type CheckinReadState = 'loading' | 'ready' | 'error' | 'private'

function SquadPanel({ m, team, checkins, rosterReadState, myCheckinReadState }: {
  m: MatchDto
  team: MatchTeamRef
  checkins: MatchCheckinDto[]
  rosterReadState: CheckinReadState
  myCheckinReadState: Exclude<CheckinReadState, 'private'>
}) {
  const checkin = useCheckin(m.id)
  const verify = useVerifyCheckin(m.id)
  const isRef = m.viewer.can.manageCheckin
  /* ตัดสินการเช็คอินของคนอื่นได้ไหม — คนละเรื่องกับการดูคอนโซล ดู can.verifyCheckin */
  const canJudge = m.viewer.can.verifyCheckin
  const inCount = team.players.filter(p => p.checkinStatus === 'checked_in').length

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
        {/* ผู้เล่นเห็นแค่แถวของตัวเอง เขียน "1 of 12 in" ก็เท่ากับโกหกว่าที่เหลือยังไม่มา */}
        <span className="tag">
          {isRef ? `${inCount} of ${team.players.length} in` : `${team.players.length} on the sheet`}
        </span>
      </div>
      {/* ผู้เล่นอ่านรายการเช็คอินไม่ได้ (403) — คำตอบของการส่งจึงเป็นที่เดียวที่เจ้าตัวเห็นผล */}
      {checkin.isSuccess ? (
        <Banner kind={checkin.data.status === 'success' ? 'ok' : 'warn'} icon="check">
          {checkin.data.status === 'success'
            ? <><b>เช็คอินเรียบร้อย</b> กรรมการเห็นชื่อคุณในรายการแล้ว</>
            : <><b>ส่งรูปบัตรแล้ว</b> รอกรรมการตรวจ — สถานะจะเปลี่ยนเมื่อกรรมการกดผ่าน</>}
        </Banner>
      ) : null}
      {checkin.isError ? (
        <Banner kind="crit"><b>เช็คอินไม่สำเร็จ</b> {checkinErrorMessage(checkin.error)}</Banner>
      ) : null}
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
              const checkedIn = c?.status === 'success' || p.checkinStatus === 'checked_in'
              const pending = c?.status === 'exception' || p.checkinStatus === 'pending_verification'
              const rejected = c?.status === 'rejected' || p.checkinStatus === 'rejected'
              const notYet = !checkedIn && !pending && !rejected
              const missingState = rosterReadState === 'ready'
                ? 'ready'
                : isMe
                  ? myCheckinReadState
                  : rosterReadState
              const missingLabel = missingState === 'ready'
                ? 'Not yet'
                : missingState === 'loading'
                  ? 'Checking...'
                  : missingState === 'error'
                    ? 'Status unavailable'
                    : 'Not visible'
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
                    {checkedIn ? <Badge kind="ok">Checked in</Badge>
                      : rejected ? <Badge kind="crit">Rejected</Badge>
                        : pending ? <Badge kind="warn">Needs a look</Badge>
                          : <Badge kind="warn">{missingLabel}</Badge>}
                    {/* เหตุผลที่ถูกปฏิเสธ กับเหตุผลที่กรรมการอนุโลมให้ เป็นคนละช่องแล้ว
                        ตั้งแต่ migration 015 — เลิกเดาจากสถานะ */}
                    {c?.status === 'rejected' && c.rejectionReason
                      ? <span className="sub"> {c.rejectionReason}</span>
                      : c?.note
                        ? <span className="sub"> — {c.note}</span>
                        : null}
                  </td>
                  <td>
                    {((notYet && missingState === 'ready') || rejected) && isMe ? (
                      /* ยืนยันตัวตนก่อนเสมอ — on-site สแกน QR · online ถ่ายรูปคู่บัตร */
                      <button className="btn primary" type="button" disabled={checkin.isPending}
                        onClick={() => setCapture(p.id)}>
                        {m.mode === 'onsite' ? 'Scan the QR' : 'Take the photo'}
                      </button>
                    ) : c && c.status === 'exception' && canJudge ? (
                      /* รูปที่รอตรวจ — กรรมการเปิดดูแล้วตัดสิน (FR-PV-04) */
                      <button className="btn primary" type="button"
                        onClick={() => setReview({ userId: p.id, name: p.fullName, photo: c.documentS3Key })}>
                        Review photo
                      </button>
                    ) : notYet && canJudge && missingState === 'ready' ? (
                      /* UC-04 E2b — ไม่มีกล้องหรือสัญญาณขัดข้อง กรรมการยืนยันเองแล้ว
                         บันทึกเป็นข้อยกเว้นพร้อมเหตุผล */
                      <button className="btn ghost" type="button"
                        onClick={() => setManual({ userId: p.id, name: p.fullName })}>
                        Verify by hand
                      </button>
                    ) : c && canJudge && canRevoke(c) ? (
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
          /* เหตุผลถูกเก็บเป็นหลักฐานแทนภาพ — M19 มีช่อง note ของมันเอง ไม่ใช่ช่องรูป */
          checkin.mutate(
            { method: 'manual_by_referee', userId: manual.userId, note: reason },
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


/**
 * คอนโซลเช็คอินแบบไม่มีรายชื่อทีม
 *
 * backend เปิด GET /teams/:id/members ให้เฉพาะสมาชิกของทีมนั้น — กรรมการกับผู้จัด
 * ได้ 403 จึงไม่มีทางรู้ว่า "ใครยังไม่มา" ได้เลย หน้านี้เลยแสดงเท่าที่ระบบบอกได้จริง
 * คือรายการเช็คอินที่เกิดขึ้นแล้ว และให้ผู้เล่นที่ล็อกอินอยู่เช็คอินตัวเองได้
 */
function CheckinConsole({ m, checkins }: { m: MatchDto; checkins: MatchCheckinDto[] }) {
  const checkin = useCheckin(m.id)
  const verify = useVerifyCheckin(m.id)
  const isRef = m.viewer.can.manageCheckin
  const canJudge = m.viewer.can.verifyCheckin
  const myId = m.viewer.myUserId
  const mine = myId === null ? undefined : checkins.find(c => c.user.id === myId)
  const canCheckIn = myId !== null
    && [m.teamA, m.teamB].some(team => team?.players.some(player => player.id === myId))
    && (!mine || mine.status === 'rejected')
  const [capture, setCapture] = useState(false)
  const [review, setReview] = useState<{ userId: number; name: string; photo: string | null } | null>(null)

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Check-in</span>
        {/* ยอดรวมเป็นความจริงเฉพาะกับคนที่อ่านรายการทั้งแมตช์ได้ — ผู้เล่นได้ 403
            จะเขียน "0 verified" ให้เขาอ่านก็เท่ากับบอกว่าไม่มีใครมา */}
        {isRef ? (
          <span className="tag">
            {checkins.length} · {checkins.filter(c => c.status === 'success').length} verified
          </span>
        ) : null}
      </div>

      {isRef ? (
        <span className="sub">
          The squad list is not readable by a referee on this backend, so this shows the check-ins
          that have happened rather than everyone who is expected.
        </span>
      ) : null}

      {canCheckIn ? (
        <div className="hstack">
          <button className="btn primary" type="button" disabled={checkin.isPending}
            onClick={() => setCapture(true)}>
            {m.mode === 'onsite' ? 'Scan the QR to check in' : 'Take the photo to check in'}
          </button>
          {mine?.status === 'rejected' ? <span className="sub">Your last attempt was rejected — try again.</span> : null}
        </div>
      ) : null}

      {/* ผู้เล่นอ่านรายการเช็คอินไม่ได้ (403) — คำตอบของการส่งจึงเป็นที่เดียวที่เจ้าตัวเห็นผล */}
      {checkin.isSuccess ? (
        <Banner kind={checkin.data.status === 'success' ? 'ok' : 'warn'} icon="check">
          {checkin.data.status === 'success'
            ? <><b>เช็คอินเรียบร้อย</b> กรรมการเห็นชื่อคุณในรายการแล้ว</>
            : <><b>ส่งรูปบัตรแล้ว</b> รอกรรมการตรวจ — สถานะจะเปลี่ยนเมื่อกรรมการกดผ่าน</>}
        </Banner>
      ) : null}
      {checkin.isError ? (
        <Banner kind="crit"><b>เช็คอินไม่สำเร็จ</b> {checkinErrorMessage(checkin.error)}</Banner>
      ) : null}
      {checkins.length ? (
        <TableWrap>
          <table>
            <thead><tr><th>Player</th><th>How</th><th>State</th><th /></tr></thead>
            <tbody>
              {checkins.map(c => (
                <tr key={c.id}>
                  <td>
                    <span className="hstack">
                      <span className="avatar">{c.user.fullName.slice(0, 1)}</span>{c.user.fullName}
                      {c.user.id === myId ? <span className="tag"> · you</span> : null}
                    </span>
                  </td>
                  <td className="sub">{c.method.replace(/_/g, ' ')}</td>
                  <td>
                    {c.status === 'success' ? <Badge kind="ok">Checked in</Badge>
                      : c.status === 'rejected' ? <Badge kind="crit">Rejected</Badge>
                        : <Badge kind="warn">Needs a look</Badge>}
                    {/* M13 ส่ง note มาแล้ว (`75ffb0a`) — "ทำไมคนนี้ถึงถูกอนุโลมเข้ามา"
                        เป็นร่องรอยเดียวที่กรรมการคนถัดไปกับผู้จัดมี ต้องเห็นตรงนี้ */}
                    {c.note ? <span className="sub"> — {c.note}</span> : null}
                  </td>
                  <td>
                    {canJudge && c.status === 'exception' ? (
                      <button className="btn primary" type="button"
                        onClick={() => setReview({ userId: c.user.id, name: c.user.fullName, photo: c.documentS3Key })}>
                        Review photo
                      </button>
                    ) : canJudge && canRevoke(c) ? (
                      <button className="btn danger" type="button" disabled={verify.isPending}
                        onClick={() => verify.mutate({
                          userId: c.user.id,
                          input: { status: 'rejected', rejectionReason: 'Rejected by the referee' },
                        })}>
                        Reject
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : isRef ? <span className="sub">Nobody has checked in yet.</span> : null}

      <QrScanModal
        open={capture && m.mode === 'onsite'}
        onClose={() => setCapture(false)}
        expectedToken={null}
        pending={checkin.isPending}
        onScanned={token => checkin.mutate(
          { method: 'qr_onsite', qrToken: token },
          { onSuccess: () => setCapture(false) },
        )}
      />

      <IdPhotoModal
        open={capture && m.mode === 'online'}
        onClose={() => setCapture(false)}
        pending={checkin.isPending}
        onSubmit={({ photo, documentType }) => checkin.mutate(
          { method: 'photo_online', documentType, documentS3Key: photo },
          { onSuccess: () => setCapture(false) },
        )}
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
              input: approve ? { status: 'success' } : { status: 'rejected', rejectionReason: reason ?? 'ไม่ผ่านการตรวจ' },
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
  const checkinsQuery = useCheckins(matchId)
  const myCheckinQuery = useMyCheckin(matchId)
  const checkinData = checkinsQuery.data
  const mine = myCheckinQuery.data
  const update = useUpdateMatch(matchId ?? 0, m?.tournamentId)
  const [room, setRoom] = useState<string | null>(null)

  if (!matchId || isError) return <Empty icon="warn" title="No such match" />
  if (isPending) return <Panel quiet><span className="sub">Loading check-in…</span></Panel>

  /* กรรมการกับผู้จัดได้รายการเต็ม · ผู้เล่นได้ 403 แล้วเหลือลิสต์ว่าง จึงเคยเห็นตัวเอง
     เป็น "ยังไม่เช็คอิน" ตลอดแม้เพิ่งกดไป — A9 คืนแถวของตัวเองมาเติมตรงนี้
     (เส้นนั้นไม่ส่งชื่อกลับ เพราะเป็นของคนที่ถามเอง ต้องติด id ตัวเองก่อนจับคู่กับรายชื่อทีม) */
  const listed = checkinData?.items ?? []
  const myUserId = m.viewer.myUserId
  const checkins = listed.length || !mine || myUserId === null
    ? listed
    : [{ ...mine, user: { ...mine.user, id: myUserId } }]
  const squads = [m.teamA, m.teamB].filter(Boolean) as MatchTeamRef[]
  const total = squads.reduce((n, t) => n + t.players.length, 0)
  const done = checkins.filter(c => c.status === 'success').length
  const isRef = m.viewer.can.manageCheckin
  const canJudge = m.viewer.can.verifyCheckin
  const rosterReadState: CheckinReadState = !isRef
    ? 'private'
    : checkinsQuery.isError
      ? 'error'
      : checkinsQuery.isPending || checkinsQuery.isFetching
        ? 'loading'
        : 'ready'
  const myCheckinReadState: Exclude<CheckinReadState, 'private'> = myCheckinQuery.isError
    ? 'error'
    : myCheckinQuery.isPending || myCheckinQuery.isFetching
      ? 'loading'
      : 'ready'
  const everyoneIn = total > 0 && done >= total
  const knownPlayerIds = new Set(squads.flatMap(t => t.players.map(p => p.id)))

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
                  {/* โค้ดของ backend เป็นโทเคนยาว — ต้องตัดบรรทัดได้ ไม่งั้นล้นกล่อง */}
                  <span className="v" style={{
                    fontFamily: 'var(--f-mono)', fontSize: m.checkinToken.length > 24 ? 12 : 24,
                    letterSpacing: '.06em', wordBreak: 'break-all', lineHeight: 1.4,
                  }}>
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
          {/* A null draft means untouched; an empty string remains a deliberate clear. */}
          {(
            <Field
              label="Room code — from the game client, once the lobby exists. Optional; shown to both squads once saved."
              htmlFor={`rc-${m.id}`}>
              <div className="hstack">
                <input id={`rc-${m.id}`} value={room ?? m.roomCode ?? ''} onChange={e => setRoom(e.target.value)}
                  placeholder="e.g. a ROV custom-room number" style={{ flex: 1 }} />
                <button className="btn" type="button" disabled={update.isPending}
                  onClick={() => update.mutate({ roomCode: room ?? m.roomCode ?? '' })}>
                  {update.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </Field>
          )}
        </Panel>
      ) : null}

      {!isRef && m.mode === 'online' && m.roomCode ? (
        <Banner kind="ok" icon="check">
          <b>Room code</b>{' '}
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 16, letterSpacing: '.05em' }}>{m.roomCode}</span>
        </Banner>
      ) : null}

      {isRef && !canJudge ? (
        <Banner kind="warn">
          <b>You can open and close check-in, but not judge it.</b> Confirming a photo, rejecting a
          check-in and checking a player in by hand belong to this match&apos;s referees.
        </Banner>
      ) : null}

      {isRef && rosterReadState === 'loading' ? (
        <Banner kind="warn"><b>Refreshing check-in status...</b> Missing rows are not treated as unchecked yet.</Banner>
      ) : null}

      {isRef && rosterReadState === 'error' ? (
        <Banner kind="crit">
          <b>Check-in status is unavailable.</b>{' '}
          The roster cannot safely say who has not checked in.
          <button className="btn ghost" type="button" onClick={() => { void checkinsQuery.refetch() }}>Try again</button>
        </Banner>
      ) : null}

      {!isRef && !USE_MOCK ? (
        <Banner kind="warn">
          <b>You can only see your own check-in here.</b> The full sheet belongs to the referee, so
          a blank row next to a teammate means &ldquo;not visible to you&rdquo;, not &ldquo;not
          checked in&rdquo;.
        </Banner>
      ) : null}

      {/* ทีมที่เรารู้รายชื่อ (ทีมของเราเอง) แสดงเต็มทีม — ทีมที่ไม่รู้ (backend เปิดให้เฉพาะ
          สมาชิกของทีมนั้น) แสดงเท่าที่เช็คอินเข้ามาแล้วในคอนโซลด้านล่าง ไม่ให้ซ้ำกัน */}
      {squads.filter(t => t.players.length).map(t => (
        <SquadPanel
          key={t.id}
          m={m}
          team={t}
          checkins={checkins}
          rosterReadState={rosterReadState}
          myCheckinReadState={myCheckinReadState}
        />
      ))}
      {squads.some(t => !t.players.length) ? (
        <CheckinConsole m={m} checkins={checkins.filter(c => !knownPlayerIds.has(c.user.id))} />
      ) : null}

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
