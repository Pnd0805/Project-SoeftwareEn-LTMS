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
  const settled = result?.status === 'verified'
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
      title: `Result recorded by ${recorder}`,
      note: recorded
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
      note: settled
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
