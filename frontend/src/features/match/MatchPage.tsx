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
  Banner, Crumb, Empty, Facts, Field, MatchStateBadge, Panel, Tabs,
} from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { ScorebugView } from '../../components/kit/Scorebug'
import {
  useMatch, useResult, useVerifyResult, useDisputeResult, useResolveDispute, useSetLivestream,
} from '../../hooks/useMatch'
import { matchStateOf, toTeamView } from './matchView'
import { ResultForm } from './ResultForm'
import { ResultTrail } from './ResultTrail'
import { StatSheet } from './StatSheet'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'

const TABS = ['overview', 'lineup', 'stats', 'progress', 'community']

/** สกอร์ที่จะโชว์บน scorebug — อ่านจากผล ไม่ใช่จากแมตช์ */
function scoreOf(r?: MatchResultDto) {
  const sd = r?.scoreData as { a?: number; b?: number; decider?: { a: number; b: number; kind: string } } | undefined
  return {
    a: sd?.a ?? null,
    b: sd?.b ?? null,
    decider: sd?.decider ?? null,
  }
}

/** Organizer only: reopen a signed-off result, and the replay link once it is done. */
function OrganizerTools({ m, result }: { m: MatchDto; result?: MatchResultDto }) {
  const [replay, setReplay] = useState(m.replayUrl ?? '')
  const setLivestream = useSetLivestream(m.id)
  const settled = result?.status === 'verified'

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

/** The organizer settles it, and recording a new score closes the dispute (FR-RS-04). */
function ResolvePanel({ m, result }: { m: MatchDto; result: MatchResultDto }) {
  const s = scoreOf(result)
  const [sa, setSa] = useState(s.a ?? 0)
  const [sb, setSb] = useState(s.b ?? 0)
  const resolve = useResolveDispute(m.id, m.tournamentId)
  return (
    <Panel>
      <span className="tag"><em>//</em> Resolve the dispute — your decision is final</span>
      <Banner kind="crit">
        <b>{result.disputeRaisedBy?.fullName ?? 'A team'}</b> disputed this result
        {result.disputeReason ? <> — “{result.disputeReason}”</> : null}. Recording a new score closes
        the dispute and advances the bracket.
      </Banner>
      <div className="grid2" style={{ maxWidth: 420 }}>
        <Field label={m.teamA?.name ?? 'Home'} htmlFor="rs-a">
          <input id="rs-a" type="number" min={0} value={sa} onChange={e => setSa(Number(e.target.value))} />
        </Field>
        <Field label={m.teamB?.name ?? 'Away'} htmlFor="rs-b">
          <input id="rs-b" type="number" min={0} value={sb} onChange={e => setSb(Number(e.target.value))} />
        </Field>
      </div>
      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
        disabled={resolve.isPending}
        onClick={() => resolve.mutate({
          resolution: `Organizer recorded ${sa}–${sb}`,
          winnerTeamId: sa === sb ? null : sa > sb ? m.teamA?.id ?? null : m.teamB?.id ?? null,
          scoreData: { a: sa, b: sb },
        })}>
        {resolve.isPending ? 'Recording…' : 'Record the final score'}
      </button>
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
    if (can.verifyResult) {
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

  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Waiting</span>
      <div className="sub">
        No result recorded yet. {m.mode === 'onsite' ? 'The referee' : "The winning team's leader"} records it first.
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
  const state = matchStateOf({ ...m, resultStatus: result?.status ?? null })
  const sc = scoreOf(result)
  const settled = result?.status === 'verified'
  const winnerId = settled ? result?.winnerTeamId ?? null : null

  return (
    <>
      <Crumb back={{ label: m.tournament.name, onClick: () => navigate(`/t/${m.tournament.id}`) }}>{m.tag}</Crumb>
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
          />
          <Tabs tabs={TABS.map(x => ({ key: x, label: x === 'community' ? 'Community' : x }))} active={tab}
            onPick={k => navigate(`/m/${m.id}/${k}`)} />

          {tab === 'overview' ? (
            <>
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
              {m.viewer.can.manageCheckin || m.viewer.myTeamId ? (
                <Panel quiet>
                  <span className="tag"><em>//</em> Check-in</span>
                  <div className="hstack">
                    <button className="btn" type="button" onClick={() => navigate(`/checkin/${m.id}`)}>
                      {m.viewer.can.manageCheckin ? 'Check-in console' : 'Go to check-in'}
                    </button>
                    <span className="sub">{m.checkedIn} of {m.lineupSize} checked in.</span>
                  </div>
                </Panel>
              ) : null}
            </>
          ) : null}

          {tab === 'lineup' ? (
            <Panel quiet>
              <span className="tag"><em>//</em> Lineup</span>
              <div className="sub">
                Naming starters and substitutes is <b>FR-TM-04, team management</b> — the schema keeps
                it on <code>team_members.position</code>, per team, not per match. The per-match Lineup
                the prototype drew has no requirement behind it and no table to store it. Needs a
                decision before it is rebuilt; see PLAN.md.
              </div>
            </Panel>
          ) : null}

          {tab === 'stats' ? <StatSheet m={m} /> : null}
          {tab === 'progress' ? <ResultTrail m={m} result={result} /> : null}

          {tab === 'community' ? (
            <Panel quiet>
              <span className="tag"><em>//</em> Community</span>
              <div className="sub">
                Comments and Pick'em are slice 1's Engagement work and arrive with it. SRS puts both
                in Sprint #1.
              </div>
            </Panel>
          ) : null}
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
