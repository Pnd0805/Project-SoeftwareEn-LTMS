/**
 * src/features/match/MatchPage.tsx
 *
 * Scorebug and the action you can take (enter / confirm / resolve) on the left —
 * kick-off, venue, mode, referees and stage in the rail.
 *
 * On-site and online have the same two steps and swap who performs each. SRS
 * FR-RS-03: on-site the referee records and the winning leader confirms.
 * FR-RS-02: online the winning leader submits and the referee confirms. SRS
 * §3.1.1 makes that two-party confirmation a hard boundary — the system never
 * decides a result itself, and nothing reaches the bracket until both sides sign.
 *
 * ── ย้ายมาใช้ API แล้ว ─────────────────────────────────────────────────────
 * ใครทำอะไรได้ มาจาก `m.viewer.can` ที่ server ตัดสิน ไม่ใช่ frontend คำนวณเอง
 * โค้ดเดิมไล่ดู m.refs / organizer / หัวหน้าทีมที่ชนะ แล้วผสมกับสถานะแมตช์เอง
 * ซึ่ง backend ต้องเช็คซ้ำอยู่ดี — กติกาเดียวกันเขียนสองที่แล้วจะเพี้ยนจากกัน
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Badge, Banner, Crumb, Empty, Facts, Field, MatchStateBadge, Panel, TableWrap, Tabs,
} from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { ScorebugView } from '../../components/kit/Scorebug'
import {
  useCloseMatchCheckin, useDisputeResult, useForfeitMatch, useMatch, useOpenMatchCheckin,
  useResolveDispute, useResult, useSetLivestream, useStartMatch, useVerifyResult,
} from '../../hooks/useMatch'
import { USE_MOCK } from '../../api/client'
import { useLtms } from '../../shared/store'
import { findStoreMatch, tournamentRouteId } from '../../mocks/storeBridge'
import { matchStateOf, toTeamView } from './matchView'
import { ResultForm } from './ResultForm'
import { ResultTrail } from './ResultTrail'
import { SocialBar } from './SocialBar'
import { StatSheet } from './StatSheet'
import type { MatchDto, MatchResultDto, MatchTeamRef } from '../../types/match.dto'

const TABS = ['overview', 'lineup', 'stats', 'progress', 'community']

/**
 * จบแล้วหรือยัง — `walkover` จบพอๆ กับ `verified` (ไม่มีใครต้องยืนยันอีก
 * และ S03 โต้แย้งไม่ได้ ตอบ `RESULT_IS_WALKOVER`) ต่างกันแค่ไม่ได้ลงแข่งจริง
 */
const isSettled = (r?: MatchResultDto) => r?.status === 'verified' || r?.status === 'walkover'

/**
 * สกอร์ที่จะโชว์บน scorebug — อ่านจากผล ไม่ใช่จากแมตช์
 *
 * `score_data` ของ backend เป็น map teamId → แต้ม ส่วน prototype เก็บเป็น a/b
 * อ่านทั้งสองแบบเพราะแถวผลที่กรอกไว้ก่อนแก้เรื่องคีย์ยังเป็น a/b อยู่
 */
function scoreOf(r?: MatchResultDto, m?: MatchDto) {
  const sd = r?.scoreData as Record<string, unknown> | undefined
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  const side = (t: MatchTeamRef | null | undefined, legacy: unknown) =>
    (t ? num(sd?.[String(t.id)]) : null) ?? num(legacy)
  return {
    a: side(m?.teamA, sd?.a),
    b: side(m?.teamB, sd?.b),
    decider: (sd?.decider as { a: number; b: number; kind: string } | undefined) ?? null,
  }
}

/**
 * วงจรชีวิตของแมตช์ — เปิด/ปิดเช็คอิน เริ่มแข่ง และตัดสินทีมไม่มาตามนัด
 *
 * ทั้งสี่เส้นมีใน backend มาตลอด (M09/M10/M17/M18) แต่ไม่เคยมีปุ่มไหนเรียกเลย
 * แมตช์จึงออกจาก `scheduled` ไม่ได้ถ้าไม่ไปยิง SQL เอง — นี่คือเหตุผลที่ข้อมูล
 * ทดสอบต้องสร้างด้วยสคริปต์
 *
 * ใครกดอะไรได้ backend เป็นคนตัดสินเสมอ (requireOrganizerOfMatch /
 * requireReferee) ตรงนี้แค่ไม่โชว์ปุ่มที่รู้อยู่แล้วว่าจะเด้ง
 */
function MatchLifecycle({ m }: { m: MatchDto }) {
  const isOrganizer = m.viewer.roles.includes('organizer')
  const isReferee = m.viewer.roles.includes('referee')
  const openCheckin = useOpenMatchCheckin(m.id, m.tournamentId)
  const closeCheckin = useCloseMatchCheckin(m.id, m.tournamentId)
  const start = useStartMatch(m.id, m.tournamentId)
  const forfeit = useForfeitMatch(m.id, m.tournamentId)
  /* ตัดสินไม่มาตามนัดแล้วแมตช์จบทันที ย้อนไม่ได้ — ต้องกดยืนยันอีกชั้น */
  const [confirmForfeit, setConfirmForfeit] = useState(false)

  if (!isOrganizer && !isReferee) return null
  if (m.status !== 'scheduled' && m.status !== 'checkin_open') return null
  /* นัดที่ยังรอผู้ชนะจากรอบก่อนยังไม่มีคู่แข่ง — เปิดเช็คอินให้ใครไม่ได้
     (start กับ forfeit ฝั่ง backend ก็ตอบ 409 MATCH_TEAMS_INCOMPLETE อยู่แล้ว) */
  if (!m.teamA || !m.teamB) return null

  const busy = openCheckin.isPending || closeCheckin.isPending || start.isPending || forfeit.isPending
  const failed = [openCheckin, closeCheckin, start, forfeit].find(x => x.isError)

  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Match control — {isOrganizer ? 'organizer' : 'referee'}</span>

      {m.status === 'scheduled' && isOrganizer ? (
        <>
          <div className="sub">
            Opening check-in lets both squads confirm they are here. Appoint every referee first —
            the server refuses a new appointment once check-in is open.
          </div>
          <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
            disabled={busy} onClick={() => openCheckin.mutate()}>
            {openCheckin.isPending ? 'Opening…' : 'Open check-in'}
          </button>
        </>
      ) : null}

      {m.status === 'checkin_open' ? (
        <>
          {isReferee ? (
            <>
              <div className="sub">
                Starting the match needs every referee in place and each squad at its sport&apos;s
                minimum. A squad short of it loses by walkover.
              </div>
              <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
                disabled={busy} onClick={() => start.mutate()}>
                {start.isPending ? 'Starting…' : 'Start the match'}
              </button>
            </>
          ) : null}

          {isOrganizer ? (
            <>
              <div className="sub">
                Opened the wrong match, or the fixture moved? Closing check-in puts it back to
                scheduled and keeps the check-ins already taken.
              </div>
              <span className="hstack">
                <button className="btn" type="button" disabled={busy}
                  onClick={() => closeCheckin.mutate()}>
                  {closeCheckin.isPending ? 'Closing…' : 'Close check-in'}
                </button>
                {confirmForfeit ? (
                  <>
                    <button className="btn crit" type="button" disabled={busy}
                      onClick={() => { setConfirmForfeit(false); forfeit.mutate() }}>
                      {forfeit.isPending ? 'Settling…' : 'Yes — settle it as a no-show'}
                    </button>
                    <button className="btn ghost" type="button" disabled={busy}
                      onClick={() => setConfirmForfeit(false)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn" type="button" disabled={busy}
                    onClick={() => setConfirmForfeit(true)}>A squad did not show up</button>
                )}
              </span>
              {confirmForfeit ? (
                <Banner kind="warn">
                  <b>This ends the match.</b> Whichever squad is short of its sport&apos;s minimum
                  loses by walkover — both, if neither turned up. It cannot be undone from here.
                </Banner>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {forfeit.isSuccess ? (
        <Banner kind="ok" icon="check">
          <b>Settled.</b>{' '}
          {forfeit.data.kind === 'double_forfeit'
            ? 'Neither squad had enough players checked in, so both forfeited.'
            : `Recorded as a walkover — ${forfeit.data.minMembers} players were needed.`}
        </Banner>
      ) : null}

      {failed ? (
        <Banner kind="crit">
          <b>That did not go through.</b>{' '}
          {failed.error instanceof Error ? failed.error.message : 'Something went wrong.'}
        </Banner>
      ) : null}
    </Panel>
  )
}

/** Organizer only: reopen a signed-off result, and the replay link once it is done. */
function OrganizerTools({ m, result }: { m: MatchDto; result?: MatchResultDto }) {
  const [replay, setReplay] = useState(m.replayUrl ?? '')
  const setLivestream = useSetLivestream(m.id)
  const settled = isSettled(result)

  if (!settled) return null
  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Replay link — organizer only</span>
      <Field label="Link to video of this match" htmlFor={`rp-${m.id}`}>
        <input id={`rp-${m.id}`} value={replay} onChange={e => setReplay(e.target.value)} placeholder="https://…" />
      </Field>
      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
        disabled={setLivestream.isPending}
        onClick={() => setLivestream.mutate(replay || null)}>
        {setLivestream.isPending ? 'Saving…' : 'Save replay link'}
      </button>
      {setLivestream.isError ? (
        <Banner kind="crit">Could not save the link. It is not stored yet — see TODO(schema) on livestreamUrl.</Banner>
      ) : null}
    </Panel>
  )
}

/**
 * ผู้จัดเป็นคนชี้ขาด (FR-RS-04)
 *
 * B4 (`c43f497`) เปิดทางที่สามให้แล้ว — เดิมมีแค่ยืนผลเดิมกับยกผลทิ้ง ซึ่งไม่ตอบโจทย์
 * เหตุผลที่คนค้านกันจริงๆ คือ "สกอร์ผิด" · ตอนนี้ผู้จัดเขียนผลที่ถูกต้องลงไปได้เลย
 * (amend → verified ทันที ติดธง isAmended) และ reject ก็ถอนผลออกจริง ทั้งสาย ตาราง
 * และสถิติที่ผลนั้นเคยเดินไปแล้ว
 */
function ResolvePanel({ m, result }: { m: MatchDto; result: MatchResultDto }) {
  const s = scoreOf(result, m)
  const [sa, setSa] = useState(s.a ?? 0)
  const [sb, setSb] = useState(s.b ?? 0)
  const [note, setNote] = useState('')
  const resolve = useResolveDispute(m.id, m.tournamentId)
  const disputedBy = result.disputeRaisedBy?.fullName ?? 'A team'
  /* คำตัดสินทุกแบบต้องมีเหตุผล ทั้งสองทีมอ่าน · เสมอไม่มีผู้ชนะให้บันทึก (backend บังคับ
     winnerTeamId เป็น int) จึงแก้เป็นสกอร์เสมอไม่ได้ ต้องเลือกทางอื่นแทน */
  const blocked = resolve.isPending || !note.trim()
  const level = sa === sb

  return (
    <Panel>
      <span className="tag"><em>//</em> Resolve the dispute — your decision is final</span>
      <Banner kind="crit">
        <b>{disputedBy}</b> disputed this result
        {result.disputeReason ? <> — “{result.disputeReason}”</> : null}.
        {USE_MOCK
          ? ' Recording a new score closes the dispute and advances the bracket.'
          : ` The score on record is ${s.a ?? '—'}–${s.b ?? '—'}.`}
      </Banner>

      {USE_MOCK ? (
        <>
          <div className="grid2" style={{ maxWidth: 420 }}>
            <Field label={m.teamA?.name ?? 'Home'} htmlFor="rs-a">
              <input id="rs-a" type="number" min={0} value={sa} onChange={e => setSa(Number(e.target.value))} />
            </Field>
            <Field label={m.teamB?.name ?? 'Away'} htmlFor="rs-b">
              <input id="rs-b" type="number" min={0} value={sb} onChange={e => setSb(Number(e.target.value))} />
            </Field>
          </div>
          <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
            disabled={resolve.isPending || level}
            title={level ? 'A corrected score still needs a winner' : undefined}
            onClick={() => resolve.mutate({
              resolution: `Organizer recorded ${sa}–${sb}`,
              winnerTeamId: sa > sb ? m.teamA?.id ?? null : m.teamB?.id ?? null,
              scoreData: { a: sa, b: sb },
            })}>
            {resolve.isPending ? 'Recording…' : 'Record the final score'}
          </button>
        </>
      ) : (
        <>
          <Field label="Why — both squads see this" htmlFor="rs-note">
            <textarea id="rs-note" rows={2} maxLength={500} value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What you checked and what you decided." />
          </Field>
          <div className="grid2" style={{ maxWidth: 420 }}>
            <Field label={m.teamA?.name ?? 'Home'} htmlFor="rs-a">
              <input id="rs-a" type="number" min={0} value={sa} onChange={e => setSa(Number(e.target.value))} />
            </Field>
            <Field label={m.teamB?.name ?? 'Away'} htmlFor="rs-b">
              <input id="rs-b" type="number" min={0} value={sb} onChange={e => setSb(Number(e.target.value))} />
            </Field>
          </div>
          <span className="hstack">
            <button className="btn primary" type="button" disabled={blocked || level}
              title={level ? 'A corrected score still needs a winner' : undefined}
              onClick={() => resolve.mutate({
                decision: 'amend',
                resolution: note.trim(),
                winnerTeamId: sa > sb ? m.teamA?.id ?? null : m.teamB?.id ?? null,
                scoreData: { a: sa, b: sb },
              })}>
              Record this score as final
            </button>
            <button className="btn" type="button" disabled={blocked}
              onClick={() => resolve.mutate({ decision: 'uphold', resolution: note.trim() })}>
              Keep the recorded score
            </button>
            <button className="btn crit" type="button" disabled={blocked}
              onClick={() => resolve.mutate({ decision: 'reject', resolution: note.trim() })}>
              Throw the result out
            </button>
          </span>
          <div className="sub">
            {level
              ? 'Every match needs a winner. Finish the tiebreak on the field and record an aggregate score with one side ahead.'
              : 'Throwing it out undoes what the result already did — the bracket, the table and the player stats — and leaves the match open for a fresh one.'}
          </div>
        </>
      )}

      {resolve.isError ? (
        <Banner kind="crit">
          <b>That did not go through.</b>{' '}
          {resolve.error instanceof Error ? resolve.error.message : 'Something went wrong.'}
        </Banner>
      ) : null}
    </Panel>
  )
}

/** The one thing this person can do to this match, if anything. */
function ActionPanel({ m, result }: { m: MatchDto; result?: MatchResultDto }) {
  const can = m.viewer.can
  const verify = useVerifyResult(m.id, m.tournamentId)
  const dispute = useDisputeResult(m.id, m.tournamentId)
  const [reason, setReason] = useState('')

  if (!m.teamA || !m.teamB) {
    return (
      <Banner kind="warn" icon="clock">
        This match is waiting on earlier rounds. Both places fill in automatically when the feeding
        matches are confirmed.
      </Banner>
    )
  }

  if (result?.status === 'disputed') {
    return can.resolveDispute ? <ResolvePanel m={m} result={result} /> : (
      <Banner kind="crit">
        <b>Under dispute.</b> {result.disputeRaisedBy?.fullName ?? 'A team'} contested this result.
        The organizer decides.
      </Banner>
    )
  }

  /* ชนะบาย — ไม่มีใครลงแข่ง จึงไม่มีอะไรให้ยืนยันหรือโต้แย้ง สกอร์ที่เห็นคือสกอร์บาย
     ประจำกีฬา (`sport_types.walkover_score`) ไม่ใช่ผลการแข่ง · ถอน/ไม่มาทั้งคู่ =
     ไม่มีผู้ชนะ ไม่มีใครเดินสาย ช่องรอบถัดไปว่างถาวร (GUIDE/11 §10.5) */
  if (result?.status === 'walkover') {
    const winner = result.winnerTeamId === m.teamA.id ? m.teamA
      : result.winnerTeamId === m.teamB.id ? m.teamB : null
    return winner ? (
      <Banner kind="ok" icon="check">
        <b>{winner.name} won by walkover.</b> The other squad withdrew or could not field enough
        players. The score on record is this sport&apos;s walkover score, not a played result.
      </Banner>
    ) : (
      <Banner kind="warn" icon="clock">
        <b>No contest.</b> Both squads forfeited, so nobody advances. The place this match fed
        stays empty and whoever was waiting there goes through.
      </Banner>
    )
  }

  if (result?.status === 'verified') {
    const winner = result.winnerTeamId === m.teamA.id ? m.teamA
      : result.winnerTeamId === m.teamB.id ? m.teamB : null
    const isChampion = !!winner && m.tournament.championTeamId === winner.id
    return (
      <Banner kind="ok" icon="check">
        <b>Confirmed.</b> {winner ? `${winner.name} advanced.` : ''}{' '}
        {isChampion ? 'They won the tournament.' : ''}
      </Banner>
    )
  }

  /* A result is in and waiting on the other side to sign it (SRS FR-RS-02/03). */
  if (result?.status === 'submitted') {
    /* on-site ผู้ยืนยันคือหัวหน้า "ทีมที่ชนะ" เท่านั้น (BR-13 · backend ใช้
       isLeaderOfTeam(winner_team_id)) — เดิมโชว์แผงนี้ให้หัวหน้าทั้งสองฝั่ง ฝั่งที่แพ้จึง
       อ่านว่า "You won, so you confirm" แล้วกดไปเจอ 403 WRONG_SUBMITTER_ROLE
       ฝั่งที่แพ้ต้องตกไปแผง Waiting ข้างล่าง ซึ่งมีช่องโต้แย้งให้ตามดีไซน์ */
    const iConfirm = can.verifyResult
      && (m.mode !== 'onsite' || result.winnerTeamId === m.viewer.myTeamId)
    if (iConfirm) {
      return (
        <Panel>
          <span className="tag"><em>//</em> Your confirmation</span>
          <Banner kind="warn">
            {m.mode === 'onsite'
              ? <><b>You won, so you confirm.</b> The losing side does not sign off — they raise a dispute instead.</>
              : <><b>You are the referee.</b> Check the submitted score against the record before confirming.</>}
          </Banner>
          {can.disputeResult ? (
            <Field label="Reason, if you are disputing instead" htmlFor="dp-why">
              <input id="dp-why" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="What does not match?" />
            </Field>
          ) : null}
          <div className="hstack">
            {can.disputeResult ? (
              <button className="btn danger" type="button"
                disabled={dispute.isPending || !reason.trim()}
                onClick={() => dispute.mutate({ reason: reason.trim(), teamId: m.viewer.myTeamId ?? 0 })}>
                Dispute result
              </button>
            ) : null}
            <button className="btn primary" type="button" disabled={verify.isPending}
              onClick={() => verify.mutate({})}>
              {verify.isPending ? 'Confirming…' : 'Confirm result'}
            </button>
          </div>
        </Panel>
      )
    }
    return (
      <Panel quiet>
        <span className="tag"><em>//</em> Waiting</span>
        <div className="sub">
          Entered by {result.submittedBy.fullName}. Waiting on the{' '}
          {m.mode === 'onsite' ? 'winning team leader' : 'referee'} to confirm.
        </div>
        {can.disputeResult ? (
          <>
            <Field label="Why are you disputing this?" htmlFor="dp-why2">
              <input id="dp-why2" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="What does not match?" />
            </Field>
            <button className="btn danger" type="button" style={{ alignSelf: 'flex-start' }}
              disabled={dispute.isPending || !reason.trim()}
              onClick={() => dispute.mutate({ reason: reason.trim(), teamId: m.viewer.myTeamId ?? 0 })}>
              Dispute this result
            </button>
          </>
        ) : null}
      </Panel>
    )
  }

  /* No result yet. Whoever records first depends on the mode. */
  if (can.submitResult) return <ResultForm m={m} />

  /* แมตช์ที่โต้แย้งอยู่แต่คนดูไม่มีสิทธิ์เห็นผล (A7 เปิดให้เฉพาะผู้จัด กรรมการของแมตช์
     และหัวหน้าทีมสองฝั่ง) — คนอื่นได้ 404 จึงมาถึงตรงนี้โดยไม่มี result */
  if (m.status === 'disputed') {
    return (
      <Panel quiet>
        <span className="tag"><em>//</em> Disputed</span>
        <div className="sub">
          A result was recorded and one of the squads is disputing it. Only the organizer, this
          match&apos;s referees and the two squad leaders can see the score while that is settled.
        </div>
      </Panel>
    )
  }

  /* ใบผลอ่านได้เฉพาะผู้จัด กรรมการของแมตช์ และหัวหน้าสองทีม (S05) — ผู้เล่นธรรมดาได้ 404
     จึงมาถึงตรงนี้ทั้งที่ผลส่งไปแล้ว เขียนว่า "ยังไม่มีใครกรอก" ก็ผิด และขัดกับป้ายสถานะ
     ข้างบนที่อ่าน resultStatus จาก M05 ซึ่งเป็นข้อมูลสาธารณะ */
  if (m.resultStatus === 'submitted') {
    return (
      <Panel quiet>
        <span className="tag"><em>//</em> Waiting</span>
        <div className="sub">
          A result is in, waiting on the {m.mode === 'onsite' ? 'winning team leader' : 'referee'} to
          confirm it. The score stays with the organizer, this match&apos;s referees and the two
          squad leaders until then.
        </div>
      </Panel>
    )
  }

  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Waiting</span>
      <div className="sub">
        No result recorded yet. {m.mode === 'onsite' ? 'The referee' : "The winning team's leader"} records it first.
      </div>
    </Panel>
  )
}

/**
 * Pick'em และความเห็นของแมตช์ — SocialBar เป็นงาน Engagement ของสไลซ์ 1 (FR-PK-01, FR-CM-01)
 *
 * SocialBar ยังรับ `Match` ของ store ไม่ใช่ `MatchDto` และ backend ยังไม่มี route
 * (SDS `POST /matches/{id}/predictions`, `POST /tournaments/{id}/comments`)
 * จึงแสดงได้เฉพาะโหมด mock กับแมตช์ที่อยู่ใน store — นอกนั้นบอกว่ายังใช้ไม่ได้ ไม่เรียก path ที่ไม่มี
 */
function MatchCommunity({ matchId }: { matchId: string }) {
  /* หาแมตช์ใหม่ทุกครั้งที่ store commit ไม่งั้นถือ object เก่าไว้หลัง reset demo */
  useLtms()
  const stored = USE_MOCK ? findStoreMatch(matchId) : undefined
  if (stored) return <SocialBar m={stored} />
  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Community</span>
      <div className="sub">
        Pick'em and comments aren't available for this match yet.
        {USE_MOCK ? '' : ' The server doesn\'t offer them yet.'}
      </div>
    </Panel>
  )
}

export function MatchPage() {
  const navigate = useNavigate()
  const { id, tab: tabParam } = useParams()
  /* ส่ง id ดิบจาก URL ไป — ชั้น API รับได้ทั้งเลขของ API และ string ของ store
     ระหว่างที่สไลซ์อื่นยังไม่ย้าย (ดู mocks/storeBridge.ts) */
  const matchId = id

  const { data: m, isPending, isError } = useMatch(matchId)
  const { data: result } = useResult(matchId)

  if (!matchId || isError) return <Empty icon="warn" title="No such match" />
  if (isPending) return <Panel quiet><span className="sub">Loading the match…</span></Panel>

  const tab = TABS.includes(tabParam ?? '') ? tabParam! : 'overview'
  /* ใบผล (S05) เปิดให้เฉพาะผู้จัด กรรมการของแมตช์ และหัวหน้าสองทีม คนอื่นได้ 404
     เดิมเขียน `?? null` ทับ ผู้เล่นธรรมดาจึงเห็นป้ายเป็น "Check-in open" ขณะที่หัวหน้าทีม
     เห็น "Awaiting confirmation" ทั้งที่ M05 ส่ง resultStatus มาให้ทุกคนอยู่แล้ว (B5) */
  const state = matchStateOf({ ...m, resultStatus: result?.status ?? m.resultStatus })
  const sc = scoreOf(result, m)
  const settled = isSettled(result)
  const winnerId = settled ? result?.winnerTeamId ?? null : null
  const isInLineup = m.viewer.myUserId !== null
    && [m.teamA, m.teamB].some(team => team?.players.some(player => player.id === m.viewer.myUserId))

  return (
    <>
      <Crumb back={{ label: m.tournament.name, onClick: () => navigate(`/t/${tournamentRouteId(m.tournament.id)}`) }}>{m.tag}</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 28 }}>{m.stage}</h1>
        <MatchStateBadge state={state} />
      </div>

      <div className="split">
        <div>
          <ScorebugView
            home={toTeamView(m.teamA)} away={toTeamView(m.teamB)}
            scoreA={sc.a} scoreB={sc.b}
            tag={m.tag} decided={settled} decider={sc.decider}
            homeLost={settled && !!m.teamA && winnerId !== m.teamA.id}
            awayLost={settled && !!m.teamB && winnerId !== m.teamB.id}
            linkTeams={!USE_MOCK || !!findStoreMatch(matchId)}
          />
          <Tabs tabs={TABS.map(x => ({ key: x, label: x === 'community' ? 'Community' : x }))} active={tab}
            onPick={k => navigate(`/m/${m.id}/${k}`)} />

          {tab === 'overview' ? (
            <>
              <MatchLifecycle m={m} />
              <ActionPanel m={m} result={result} />
              {m.viewer.roles.includes('organizer') ? <OrganizerTools m={m} result={result} /> : null}
              {m.replayUrl ? (
                <Panel quiet>
                  <span className="tag"><em>//</em> Replay</span>
                  <a className="btn primary" style={{ alignSelf: 'flex-start' }} href={m.replayUrl} target="_blank" rel="noopener">
                    <Icon name="match" size={13} /> Watch the replay
                  </a>
                </Panel>
              ) : null}
              {m.viewer.can.manageCheckin || isInLineup ? (
                <Panel quiet>
                  <span className="tag"><em>//</em> Check-in</span>
                  <div className="hstack">
                    <button className="btn" type="button" onClick={() => navigate(`/checkin/${m.id}`)}>
                      {m.viewer.can.manageCheckin ? 'Check-in console' : 'Go to check-in'}
                    </button>
                    {/* ผู้เล่นอ่าน GET /matches/:id/checkins ไม่ได้ (403) — ไม่รู้ตัวหาร
                        ก็อย่าเขียน "0 of 0" ให้เข้าใจผิดว่ายังไม่มีใครเช็คอิน */}
                    {m.lineupSize > 0
                      ? <span className="sub">{m.checkedIn} of {m.lineupSize} checked in.</span>
                      : null}
                  </div>
                </Panel>
              ) : null}
            </>
          ) : null}

          {tab === 'lineup' ? (
            <Panel quiet>
              <span className="tag"><em>//</em> Lineup</span>
              {[m.teamA, m.teamB].map((team, index) => team ? (
                <div className="vstack" key={team.id} style={{ gap: 8 }}>
                  <b>{team.name}</b>
                  {team.players.length ? (
                    <TableWrap>
                      <table>
                        <thead><tr><th>Player</th><th>Check-in</th></tr></thead>
                        <tbody>
                          {team.players.map(player => (
                            <tr key={player.id}>
                              <td><span className="hstack"><span className="avatar">{player.fullName.slice(0, 1)}</span>{player.fullName}</span></td>
                              <td>{player.checkinStatus === 'checked_in' ? <Badge kind="ok">Checked in</Badge>
                                : player.checkinStatus === 'pending_verification' ? <Badge kind="warn">Pending verification</Badge>
                                  : player.checkinStatus === 'rejected' ? <Badge kind="crit">Rejected</Badge>
                                    : <Badge kind="neutral">Not yet</Badge>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableWrap>
                  ) : <div className="sub">No approved players are attached to this side.</div>}
                </div>
              ) : <div className="sub" key={`empty-${index}`}>This side is waiting for a team.</div>)}
            </Panel>
          ) : null}

          {tab === 'stats' ? <StatSheet m={m} /> : null}
          {tab === 'progress' ? <ResultTrail m={m} result={result} /> : null}

          {tab === 'community' ? <MatchCommunity matchId={matchId} /> : null}
        </div>

        <div className="rail">
          <Panel>
            <span className="tag"><em>//</em> The details</span>
            <Facts rows={[
              ['Kick-off', m.scheduledTime ? new Date(m.scheduledTime).toLocaleString() : 'Not scheduled'],
              /* TODO(schema): FR-MM-05 asks for the venue's position so players can find it.
                 `matches` stores only the name — no coordinates on the match or a join to get them. */
              ['Venue', m.venue || '—'],
              ['Played', m.mode],
              ['Referees', m.referees.map(r => r.fullName).join(', ') || 'none assigned'],
              ['Stage', m.stage],
              ...(m.mode === 'online' && m.roomCode ? [['Room code', m.roomCode] as [string, React.ReactNode]] : []),
            ]} />
            {m.viewer.can.editFixture ? (
              <button className="btn" type="button" onClick={() => navigate(`/m/${m.id}/fixture`)}>
                <Icon name="clock" size={13} /> Edit the fixture
              </button>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  )
}
