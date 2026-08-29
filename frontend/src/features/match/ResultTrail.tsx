/**
 * src/features/match/ResultTrail.tsx
 *
 * How a result got where it is: check-in, who recorded it, who signed it off,
 * and whether the bracket moved. Drawn as a rail rather than a table because it
 * is a sequence with one live step — the reader's first question is "who is it
 * waiting on", and a three-row grid of badges never answered that.
 */
import { Badge, Panel, Trail } from '../../components/kit/primitives'
import type { TrailStep } from '../../components/kit/primitives'
import { useLtms } from '../../shared/store'
import { matchesOf, team, user } from '../../shared/selectors'
import {
  allCheckedIn, disputeName, feedersOf, formatOf, isLevel, lineupOf, matchStage, nextOf, statLabels, winnerOf,
} from '../../shared/rules'
import type { Match, Tournament } from '../../shared/types'

export function ResultTrail({ m, t }: { m: Match; t: Tournament }) {
  const s = useLtms()
  const nm = (id?: string | null) => user(s, id)?.name ?? '—'
  const recorder = t.channel === 'onsite' ? 'the referees' : "the winning team's leader"
  const signer = t.channel === 'onsite' ? "the winning team's leader" : 'the referee'
  const total = [m.a, m.b].filter(Boolean).reduce((n, x) => n + lineupOf(s, m, x).length, 0)
  const inCount = m.checkedIn.length
  const played = !!m.enteredBy || m.status !== 'scheduled'
  const win = winnerOf(m)
  const next = nextOf(s, m)

  /* A bye is settled without anybody doing anything, so it gets its own short
     trail rather than four steps of "not applicable". */
  if (m.note === 'bye') {
    const through = m.a || m.b
    return (
      <Panel quiet>
        <div className="spread"><span className="tag"><em>//</em> Result trail</span><Badge kind="neutral">Bye</Badge></div>
        <Trail steps={[
          {
            state: 'done', title: 'Bye',
            note: `${team(s, through)?.name ?? 'One squad'} drew an empty slot, so there was no match to play. Byes are spread across the draw rather than paired with each other.`,
          },
          {
            state: 'done', title: 'Bracket',
            note: `${team(s, through)?.name ?? 'They'} moved straight into ${next ? matchStage(s, next) : 'the next round'}.`,
          },
        ]} />
      </Panel>
    )
  }

  /* A fixture with an empty side is not waiting on a person — it is waiting on
     the round below it. */
  const bothIn = !!(m.a && m.b)
  const everyoneIn = allCheckedIn(s, m)
  const feeders = feedersOf(s, m).filter(x => x.status !== 'confirmed' && x.status !== 'void')

  const steps: TrailStep[] = [
    {
      state: bothIn ? 'done' : 'now',
      title: 'Teams decided',
      note: bothIn
        ? `${team(s, m.a)?.name} against ${team(s, m.b)?.name}.`
        : feeders.length
          ? `Waiting on ${feeders.length} match${feeders.length === 1 ? '' : 'es'} below it — ${[...new Set(feeders.map(x => matchStage(s, x)))].join(', ')}. Both places fill in on their own once those are confirmed.`
          : 'Waiting on the earlier round. Both places fill in on their own once it is confirmed.',
    },
    {
      state: !bothIn ? 'idle' : (played || everyoneIn) ? 'done' : inCount ? 'now' : 'idle',
      title: 'Check-in',
      note: played ? `${inCount} of ${total} players verified before kick-off.`
        : everyoneIn ? `All ${total} players verified. Nothing is left at the table.`
          : inCount ? `${inCount} of ${total} verified. A match opens once each side has somebody through.`
            : 'Nobody through yet. Check-in is self-service — a referee can only mark somebody ineligible after the fact.',
    },
    {
      state: m.enteredBy ? 'done' : bothIn && (played || everyoneIn) ? 'now' : 'idle',
      title: 'Result recorded',
      note: m.enteredBy
        ? `${nm(m.enteredBy)} recorded ${team(s, m.a)?.code} ${m.sa}–${m.sb} ${team(s, m.b)?.code}${m.decider ? `, settled ${m.decider.a}–${m.decider.b} on ${m.decider.kind.toLowerCase()}` : ''}.`
        : !bothIn ? 'Nothing can be recorded against an empty fixture.'
          : `Waiting on ${recorder}. On ${t.channel === 'onsite' ? 'an on-site' : 'an online'} match they enter the score${statLabels(t.sport).g ? ' and the per-player statistics' : ''}.`,
    },
  ]

  if (m.disputedBy || m.status === 'disputed') {
    steps.push({
      state: m.status === 'disputed' ? 'bad' : 'done',
      title: 'Disputed',
      note: m.status === 'disputed'
        ? `${disputeName(s, m)} contested the score. The organizer settles it, and their decision is final.`
        : `${disputeName(s, m)} contested it. The organizer settled the score above.`,
    })
  }

  steps.push({
    state: m.status === 'confirmed' ? 'done' : m.status === 'disputed' ? 'idle' : (bothIn && m.enteredBy) ? 'now' : 'idle',
    title: 'Confirmation',
    note: m.status === 'confirmed'
      ? `${nm(m.confirmedBy)} signed it off${m.confirmedByOrg ? ' — the organizer, because nobody else did' : ''}.`
      : m.status === 'disputed' ? 'Held until the dispute is settled.'
        : m.enteredBy ? `Waiting on ${signer}. The other side does not sign off — they raise a dispute instead.`
          : 'Nothing to confirm yet.',
  })

  steps.push({
    state: m.status === 'confirmed' ? 'done' : 'idle',
    title: 'Bracket',
    note: m.status !== 'confirmed' ? 'Blocked. The next round cannot fill until this result is settled.'
      : isLevel(m) ? 'Level. Both squads take a point — round robin is the one format where that stands.'
        : !win ? 'Recorded.'
          : next ? `${team(s, win)?.name} moved into ${matchStage(s, next)}.`
            : formatOf(t) === 'roundrobin' ? 'Recorded on the table.'
              : `${team(s, win)?.name} won ${t.name}.`,
  })

  /* the whole tournament's shape is what a reader checks next */
  const openMatches = matchesOf(s, t.id).filter(x => x.status !== 'confirmed' && x.note !== 'bye').length

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Result trail</span>
        {m.status === 'confirmed' ? <Badge kind="ok">Settled</Badge>
          : m.status === 'disputed' ? <Badge kind="crit">With the organizer</Badge>
            : !bothIn ? <Badge kind="neutral">Waiting on the earlier round</Badge>
              : <Badge kind="warn">{`Waiting on ${m.enteredBy ? signer : recorder}`}</Badge>}
      </div>
      <Trail steps={steps} />
      <span className="sub">{openMatches} match{openMatches === 1 ? '' : 'es'} in this tournament are still open.</span>
    </Panel>
  )
}
