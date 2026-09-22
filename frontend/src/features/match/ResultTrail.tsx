/**
 * src/features/match/ResultTrail.tsx
 *
 * How a result got where it is: check-in, who recorded it, who signed it off,
 * and whether the bracket moved. Drawn as a rail rather than a table because it
 * is a sequence with one live step — the reader's first question is "who is it
 * waiting on", and a three-row grid of badges never answered that.
 *
 * SRS §3.1.1 makes the two signatures the point of the whole screen: the system
 * never decides a result, and nothing reaches the bracket until both sides sign.
 */
import { Badge, Panel, Trail } from '../../components/kit/primitives'
import type { TrailStep } from '../../components/kit/primitives'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '')

export function ResultTrail({ m, result }: { m: MatchDto; result?: MatchResultDto }) {
  /* on-site: กรรมการบันทึก หัวหน้าทีมที่ชนะยืนยัน (FR-RS-03)
     online:  หัวหน้าทีมที่ชนะส่ง กรรมการยืนยัน (FR-RS-02) */
  const recorder = m.mode === 'onsite' ? 'the referees' : "the winning team's leader"
  const signer = m.mode === 'onsite' ? "the winning team's leader" : 'the referee'

  const recorded = !!result
  const disputed = result?.status === 'disputed'
  /* ใบผลแบบ `walkover` จบพอๆ กับ `verified` — ไม่มีใครต้องเซ็นอีก และสายเดินไปแล้ว
     ตั้งแต่ตอนที่ M17 เขียนแถวนั้น เดิมนับเฉพาะ `verified` รางจึงค้างที่ "รอหัวหน้า
     ทีมที่ชนะยืนยัน" ตลอดไปสำหรับแมตช์ที่แพ้บาย/แพ้ทั้งคู่ ซึ่งไม่มีหัวหน้าทีมคนไหน
     ต้องกดอะไรเลย (R13) */
  const walkover = result?.status === 'walkover'
  /* แพ้ทั้งคู่ — ไม่มีผู้ชนะ ไม่มีใครเดินสาย ช่องรอบถัดไปว่างถาวร (GUIDE/11 §10.5) */
  const noContest = walkover && result?.winnerTeamId === null
  const settled = result?.status === 'verified' || walkover
  /* ไม่ได้ลงแข่ง จึงไม่มี "ผู้บันทึก" กับ "ผู้เซ็น" ให้ไล่ — ผู้จัดตัดสินไปในขั้นเดียว */
  const byForfeit = walkover
  const everyoneIn = m.lineupSize > 0 && m.checkedIn >= m.lineupSize

  const steps: TrailStep[] = [
    {
      state: everyoneIn ? 'done' : recorded ? 'done' : 'now',
      title: 'Check-in',
      note: everyoneIn
        ? `All ${m.lineupSize} players checked in.`
        : `${m.checkedIn} of ${m.lineupSize} checked in.`,
    },
    {
      state: recorded ? 'done' : 'now',
      title: byForfeit ? 'Settled without play' : `Result recorded by ${recorder}`,
      note: byForfeit
        ? noContest
          ? <>Neither squad fielded enough players, so both forfeited · {when(result!.createdAt)}</>
          : <>A squad did not field enough players, so the other won by walkover · {when(result!.createdAt)}</>
        : recorded
          ? <>Entered by {result!.submittedBy.fullName} · {when(result!.createdAt)}</>
          : <>Nothing recorded yet. {m.mode === 'onsite' ? 'The referee' : "The winning team's leader"} goes first.</>,
    },
    disputed
      ? {
        state: 'bad',
        title: 'Disputed',
        note: (
          <>
            {result!.disputeRaisedBy?.fullName ?? 'A team'} contested it
            {result!.disputeReason ? <> — “{result!.disputeReason}”</> : null}
            {result!.disputeRaisedAt ? <> · {when(result!.disputeRaisedAt)}</> : null}.
            The organizer decides (FR-RS-04).
          </>
        ),
      }
      : byForfeit
        ? {
          state: 'done',
          title: 'No confirmation needed',
          note: <>A forfeit is the organizer&apos;s ruling, not a played result — neither
            {' '}{signer} nor the other squad signs it off.</>,
        }
        : {
          state: settled ? 'done' : recorded ? 'now' : 'idle',
          title: `Confirmed by ${signer}`,
          note: settled
            ? <>Signed off by {result!.verifiedBy?.fullName ?? '—'} · {when(result!.verifiedAt)}</>
            : recorded
              ? <>Waiting on {signer}. Until then nothing moves.</>
              : <>Comes after the result is recorded.</>,
        },
    {
      state: settled ? 'done' : 'idle',
      title: 'Bracket updated',
      note: noContest
        ? <>Nobody advances. The place this match fed stays empty and whoever was waiting there
          goes through.</>
        : settled
          ? m.nextMatchId
            ? <>The winner moves on to the next match.</>
            : <>Final match — no further round.</>
          : <>Runs automatically once both signatures are in (FR-RS-05).</>,
    },
  ]

  return (
    <Panel quiet>
      <span className="tag">
        <em>//</em> How this result got here
        {result?.amendedAt ? <> <Badge kind="warn">Amended</Badge></> : null}
      </span>
      <Trail steps={steps} />
      {result?.amendedAt ? (
        <span className="sub">
          Amended by {result.amendedBy?.fullName ?? '—'} · {when(result.amendedAt)}
          {result.amendReason ? <> — {result.amendReason}</> : null}
        </span>
      ) : null}
      {result?.disputeResolvedAt ? (
        <span className="sub">
          Settled by {result.disputeResolvedBy?.fullName ?? '—'} · {when(result.disputeResolvedAt)}
          {result.disputeResolution ? <> — {result.disputeResolution}</> : null}
        </span>
      ) : null}
    </Panel>
  )
}
