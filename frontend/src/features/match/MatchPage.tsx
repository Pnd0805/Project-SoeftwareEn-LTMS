/**
 * src/features/match/MatchPage.tsx
 *
 * Scorebug and the action you can take (enter / confirm / resolve) on the left —
 * the action moved up from the bottom of the page; kick-off, venue, channel,
 * referees and stage in the rail.
 *
 * On-site and online have the same two steps and swap who performs each: on-site
 * the referees record and the winning leader confirms; online the winning leader
 * submits and the referee confirms. There is no dispute on an online match —
 * the referee's check before confirmation is the recourse.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Banner, Crumb, Empty, Facts, Field, Panel, StatusBadge, Tabs, VenueLine } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Scorebug } from '../../components/kit/Scorebug'
import {
  confirmResult, disputeResult, reopenResult, resolveDispute, saveReplay, useLtms,
} from '../../shared/store'
import { isOrg, match, me, team, tour, user } from '../../shared/selectors'
import { disputeName, matchStage, matchTag, fmtDate, nextOf, winnerId, winnerOf } from '../../shared/rules'
import type { Match } from '../../shared/types'
import { LineupPanel } from './LineupPanel'
import { ResultForm } from './ResultForm'
import { ResultTrail } from './ResultTrail'
import { SocialBar } from './SocialBar'
import { StatSheet } from './StatSheet'

const TABS = ['overview', 'lineup', 'stats', 'progress', 'community']

/** Organizer-only: a result nobody signed off, and the replay link once it is done. */
function OrganizerTools({ m }: { m: Match }) {
  const s = useLtms()
  const [replay, setReplay] = useState(m.replay ?? '')
  const next = nextOf(s, m)
  const dependentsPlayed = !!next && next.status !== 'scheduled'

  return (
    <>
      {m.status === 'confirmed' && !dependentsPlayed ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Organizer override</span>
          <div className="sub">Nothing has been played on top of this result yet, so it can still be reopened for review.</div>
          <button className="btn danger" type="button" style={{ alignSelf: 'flex-start' }}
            onClick={() => reopenResult(m.id)}>Reopen this result</button>
        </Panel>
      ) : null}

      {m.status === 'confirmed' ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Replay link — organizer only</span>
          <Field label="Link to video of this match" htmlFor={`rp-${m.id}`}>
            <input id={`rp-${m.id}`} value={replay} onChange={e => setReplay(e.target.value)} placeholder="https://…" />
          </Field>
          <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
            onClick={() => saveReplay(m.id, replay)}>Save replay link</button>
        </Panel>
      ) : null}
    </>
  )
}

export function MatchPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id, tab: tabParam } = useParams()
  const m = match(s, id)
  const u = me(s)

  if (!m) return <Empty icon="warn" title="No such match" />
  const t = tour(s, m.tour)!
  const A = team(s, m.a), B = team(s, m.b)
  const bothIn = !!(A && B)
  const isReferee = !!u && (m.refs || []).includes(u.id)
  const org = isOrg(s, t)
  const winner = m.status === 'pending' ? winnerId(m) : winnerOf(m)
  const leaderOfWinner = !!winner && !!u && team(s, winner)?.leader === u.id
  const anyLeader = !!u && [m.a, m.b].filter(Boolean).some(x => team(s, x)?.leader === u.id)
  const myTeamHere = u ? [m.a, m.b].find(x => team(s, x)?.members.includes(u.id)) ?? null : null

  const tab = TABS.includes(tabParam ?? '') ? tabParam! : 'overview'

  /* ── the one action this person can take on this match ── */
  let action: React.ReactNode = null
  if (!bothIn) {
    action = (
      <Banner kind="warn" icon="clock">
        This match is waiting on earlier rounds. Both places fill in automatically when the feeding
        matches are confirmed.
      </Banner>
    )
  } else if (m.status === 'scheduled' && ((t.channel === 'onsite' && isReferee) || (t.channel === 'online' && anyLeader))) {
    action = <ResultForm m={m} t={t} by={u!.id} who={t.channel === 'onsite' ? 'Referee' : 'Winning team leader'} />
  } else if (m.status === 'pending') {
    const confirmerIsMe = t.channel === 'onsite' ? leaderOfWinner : isReferee
    const label = t.channel === 'onsite' ? 'winning team leader' : 'referee'
    action = confirmerIsMe ? (
      <Panel>
        <span className="tag"><em>//</em> Your confirmation</span>
        <Banner kind="warn">
          {t.channel === 'onsite'
            ? <><b>You won, so you confirm.</b> The losing side does not sign off — they raise a dispute instead.</>
            : <><b>You are the referee.</b> Check the submitted score against the record before confirming.</>}
        </Banner>
        <div className="hstack">
          {t.channel === 'onsite' ? (
            <button className="btn danger" type="button"
              onClick={() => disputeResult(m.id, u!.id, myTeamHere ?? '')}>Dispute result</button>
          ) : null}
          <button className="btn primary" type="button" onClick={() => confirmResult(m.id, u!.id)}>Confirm result</button>
        </div>
      </Panel>
    ) : (
      <Panel quiet>
        <span className="tag"><em>//</em> Waiting</span>
        <div className="sub">
          Entered by {user(s, m.enteredBy)?.name ?? '—'}. Waiting on the {label} to confirm.
        </div>
        {anyLeader && t.channel === 'onsite' ? (
          <button className="btn danger" type="button" style={{ alignSelf: 'flex-start' }}
            onClick={() => disputeResult(m.id, u!.id, myTeamHere ?? '')}>Dispute this result</button>
        ) : null}
        {org ? (
          <div className="banner warn">
            <Icon name="warn" size={16} />
            <span className="grow">
              <b>Nobody has signed this off.</b> You can confirm it yourself — it is recorded as your
              decision, with your name on it, and both leaders are told.
            </span>
            <button className="btn primary" type="button" onClick={() => confirmResult(m.id, u!.id, true)}>
              Confirm it myself
            </button>
          </div>
        ) : null}
      </Panel>
    )
  } else if (m.status === 'disputed') {
    action = org ? <ResolvePanel m={m} /> : (
      <Banner kind="crit">
        <b>Under dispute.</b> {disputeName(s, m)} contested this result. The organizer decides.
      </Banner>
    )
  } else if (m.status === 'confirmed') {
    action = (
      <Banner kind="ok" icon="check">
        <b>Confirmed.</b> {winner ? `${team(s, winner)?.name} advanced.` : ''}{' '}
        {t.champion === winner && !nextOf(s, m) ? 'They won the tournament.' : ''}
      </Banner>
    )
  }

  const canCheckIn = !!u && bothIn && !!myTeamHere && m.status !== 'confirmed'

  return (
    <>
      <Crumb back={{ label: t.name, onClick: () => navigate(`/t/${t.id}`) }}>{matchTag(s, m)}</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 28 }}>{matchStage(s, m)}</h1>
        <StatusBadge m={m} />
      </div>

      <div className="split">
        <div>
          <Scorebug m={m} />
          <Tabs tabs={TABS.map(x => ({ key: x, label: x === 'community' ? 'Community' : x }))} active={tab}
            onPick={k => navigate(`/m/${m.id}/${k}`)} />

          {tab === 'overview' ? (
            <>
              {action}
              {org ? <OrganizerTools m={m} /> : null}
              {m.replay ? (
                <Panel quiet>
                  <span className="tag"><em>//</em> Replay</span>
                  <a className="btn primary" style={{ alignSelf: 'flex-start' }} href={m.replay} target="_blank" rel="noopener">
                    <Icon name="match" size={13} /> Watch the replay
                  </a>
                </Panel>
              ) : null}
              {canCheckIn ? (
                <Panel quiet>
                  <span className="tag"><em>//</em> Check-in</span>
                  <div className="hstack">
                    <button className="btn" type="button" onClick={() => navigate(`/checkin/${m.id}`)}>Go to check-in</button>
                    <span className="sub">{m.checkedIn.length} player{m.checkedIn.length === 1 ? '' : 's'} checked in.</span>
                  </div>
                </Panel>
              ) : null}
              {isReferee && bothIn ? (
                <div className="hstack">
                  <button className="btn" type="button" onClick={() => navigate(`/checkin/${m.id}`)}>Check-in console</button>
                </div>
              ) : null}
            </>
          ) : null}

          {tab === 'lineup' ? <LineupPanel m={m} /> : null}
          {tab === 'stats' ? (
            Object.keys(m.stats || {}).length || Object.keys(m.teamStats || {}).length
              ? <StatSheet m={m} t={t} />
              : <Empty icon="match" title="No statistics yet" sub="Recorded once the result is entered." />
          ) : null}
          {tab === 'progress' ? <ResultTrail m={m} t={t} /> : null}
          {tab === 'community' ? <SocialBar m={m} /> : null}
        </div>

        <div className="rail">
          <Panel>
            <span className="tag"><em>//</em> The details</span>
            <Facts rows={[
              ['Kick-off', fmtDate(m.kickoff)],
              ['Venue', <VenueLine name={m.venue} pin={m.pin ?? t.pin} />],
              ['Played', m.channel],
              ['Referees', (m.refs || []).map(r => user(s, r)?.name ?? '—').join(', ') || 'none assigned'],
              ['Stage', matchStage(s, m)],
              ...(m.channel === 'online' && m.roomCode ? [['Room code', m.roomCode] as [string, React.ReactNode]] : []),
            ]} />
            {org && m.status === 'scheduled' && !m.checkedIn.length ? (
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

/** The organizer settles it, and recording a new score closes the dispute. */
function ResolvePanel({ m }: { m: Match }) {
  const s = useLtms()
  const u = me(s)!
  const [sa, setSa] = useState(m.sa ?? 0)
  const [sb, setSb] = useState(m.sb ?? 0)
  const A = team(s, m.a)!, B = team(s, m.b)!
  return (
    <Panel>
      <span className="tag"><em>//</em> Resolve the dispute — your decision is final</span>
      <Banner kind="crit">
        <b>{disputeName(s, m)}</b> disputed the result. Recording a new score closes the dispute and
        advances the bracket.
      </Banner>
      <div className="grid2" style={{ maxWidth: 420 }}>
        <Field label={A.name} htmlFor="rs-a">
          <input id="rs-a" type="number" min={0} value={sa} onChange={e => setSa(Number(e.target.value))} />
        </Field>
        <Field label={B.name} htmlFor="rs-b">
          <input id="rs-b" type="number" min={0} value={sb} onChange={e => setSb(Number(e.target.value))} />
        </Field>
      </div>
      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
        onClick={() => resolveDispute(m.id, u.id, sa, sb)}>
        Record the final score
      </button>
    </Panel>
  )
}
