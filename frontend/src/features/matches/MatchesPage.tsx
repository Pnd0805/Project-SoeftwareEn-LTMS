/**
 * src/features/matches/MatchesPage.tsx
 *
 * One person wears several hats at once — officiating one tournament, playing in
 * another, running a third. Merging them into one fixture list loses the only
 * thing that matters here: what is being asked of you, and by which role.
 *
 * A referee's open matches are never one queue either: on-site and online swap
 * who moves next, so "waiting on you" means three different things.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Empty, Panel, StatusBadge, TableWrap, VenueLine } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Modal } from '../../components/kit/Modal'
import { TeamChip, TeamLink } from '../../components/kit/chips'
import { answerAppointment, useLtms } from '../../shared/store'
import { isOrg, me, team, tour, user } from '../../shared/selectors'
import { fmtDate, lineupOf } from '../../shared/rules'
import type { Match, State, Tournament } from '../../shared/types'

const REF_BUCKETS = {
  score: { label: 'Needs your score', empty: 'Nothing waiting on a score right now.' },
  confirm: { label: 'Needs your confirmation', empty: 'No submissions waiting on you.' },
  waiting: { label: 'Waiting on the squads', empty: 'Nothing parked here.' },
} as const
type Bucket = keyof typeof REF_BUCKETS

const refBucket = (m: Match, tr: Tournament): Bucket => {
  if (tr.channel === 'onsite' && m.status === 'scheduled' && m.sa == null) return 'score'
  if (tr.channel === 'online' && m.status === 'pending') return 'confirm'
  return 'waiting'
}

function RefCard({ m, tr, onPick }: { m: Match; tr: Tournament; onPick: () => void }) {
  const s = useLtms()
  const total = [m.a, m.b].reduce((n, x) => n + lineupOf(s, m, x).length, 0)
  return (
    <button type="button" className="panel quiet capsule vstack refcard" onClick={onPick}
      style={{ gap: 10, textAlign: 'left', width: '100%', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
      <div className="spread"><span className="tag"><em>//</em> {tr.name}</span><StatusBadge m={m} /></div>
      <div className="hstack" style={{ gap: 9 }}><TeamChip id={m.a} /><span className="tag">vs</span><TeamChip id={m.b} /></div>
      <div className="statline">
        <div><span className="tag">Kick-off</span><span className="v" style={{ fontSize: 16, fontFamily: 'var(--f-mono)' }}>{fmtDate(m.kickoff)}</span></div>
        <div><span className="tag">Venue</span><span className="v" style={{ fontSize: 16, fontFamily: 'var(--f-ui)' }}><VenueLine name={m.venue} pin={m.pin ?? tr.pin} /></span></div>
        <div><span className="tag">Checked in</span><span className="v" style={{ fontSize: 16, fontFamily: 'var(--f-mono)' }}>{m.checkedIn.length} / {total}</span></div>
      </div>
    </button>
  )
}

function MatchTable({ list }: { list: Match[] }) {
  const s = useLtms()
  const navigate = useNavigate()
  return (
    <TableWrap>
      <table>
        <thead>
          <tr><th>Kick-off</th><th>Tournament</th><th>Home</th><th /><th>Away</th><th>Score</th><th>State</th><th /></tr>
        </thead>
        <tbody>
          {list.map(m => (
            <tr key={m.id}>
              <td className="num">{fmtDate(m.kickoff)}</td>
              <td className="sub">{tour(s, m.tour)?.name}</td>
              <td><TeamLink id={m.a} /></td>
              <td className="tag">vs</td>
              <td><TeamLink id={m.b} /></td>
              <td className="num">{m.sa ?? '—'} – {m.sb ?? '—'}</td>
              <td><StatusBadge m={m} /></td>
              <td><button className="btn primary" type="button" onClick={() => navigate(`/m/${m.id}`)}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

/** A card summary opening straight into a short menu of what to do next. */
function RefQuickCard({ m, onClose }: { m: Match; onClose: () => void }) {
  const s: State = useLtms()
  const navigate = useNavigate()
  const tr = tour(s, m.tour)!
  const bucket = refBucket(m, tr)
  const primary = bucket === 'score' ? 'Enter the score' : bucket === 'confirm' ? 'Confirm the result' : 'Open the match'
  const blurb = bucket === 'score' ? "Both sides are due on court — record the result once it's in."
    : bucket === 'confirm' ? 'The winning squad already submitted online — confirm it to close this out.'
      : 'Nothing for you to do yet — waiting on the squads.'
  const go = (href: string) => { onClose(); navigate(href) }
  return (
    <>
      <div className="spread"><span className="tag"><em>//</em> {tr.name}</span><StatusBadge m={m} /></div>
      <div className="hstack" style={{ gap: 9 }}><TeamChip id={m.a} /><span className="tag">vs</span><TeamChip id={m.b} /></div>
      <span className="sub">{blurb}</span>
      <div className="vstack" style={{ gap: 8 }}>
        <button className="who" type="button" onClick={() => go(`/m/${m.id}`)}>
          <span className="meta"><b>{primary}</b><span className="tag">Match page</span></span><Icon name="chev" size={13} />
        </button>
        {tr.channel === 'onsite' ? (
          <button className="who" type="button" onClick={() => go(`/checkin/${m.id}`)}>
            <span className="meta"><b>Check-in console</b><span className="tag">{m.checkedIn.length} checked in</span></span>
            <Icon name="chev" size={13} />
          </button>
        ) : null}
      </div>
      <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
    </>
  )
}

export function MatchesPage() {
  const s = useLtms()
  const u = me(s)
  const [quick, setQuick] = useState<Match | null>(null)
  if (!u) return null

  const asRef = s.matches.filter(m => (m.refs || []).includes(u.id))
  const asPlayer = s.matches.filter(m => [m.a, m.b].filter(Boolean).some(x => team(s, x)?.members.includes(u.id)))
  const asOrg = s.matches.filter(m => m.a && m.b && isOrg(s, tour(s, m.tour)))
  const orgDisputes = asOrg.filter(m => m.status === 'disputed')
  const refOpen = asRef.filter(m => m.a && m.b && m.status !== 'confirmed')
  const refInv = s.refInvites.filter(i => i.user === u.id && i.status === 'pending')

  const grouped: Record<Bucket, Match[]> = { score: [], confirm: [], waiting: [] }
  refOpen.forEach(m => { grouped[refBucket(m, tour(s, m.tour)!)].push(m) })

  return (
    <>
      <h1 className="disp" style={{ fontSize: 32 }}>Matches</h1>

      {refInv.length ? (
        <Panel>
          <span className="tag"><em>//</em> Appointments waiting on your answer</span>
          {refInv.map(i => {
            const tr = tour(s, i.tour)
            if (!tr) return null
            return (
              <div className="vstack" style={{ gap: 9 }} key={i.id}>
                <div className="hstack">
                  <b>{tr.name}</b>
                  <Badge kind="neutral">{tr.channel}</Badge>
                  <span className="sub">{user(s, tr.organizer)?.name} invited you · {tr.venue} · {tr.date}</span>
                </div>
                <div className="sub">
                  Officiating is not a role and not a permission — accepting makes you eligible for this
                  tournament only, and the organizer still assigns you match by match.
                </div>
                <div className="hstack">
                  <button className="btn" type="button" onClick={() => answerAppointment(i.id, false)}>Decline</button>
                  <button className="btn primary" type="button" onClick={() => answerAppointment(i.id, true)}>Accept appointment</button>
                </div>
              </div>
            )
          })}
        </Panel>
      ) : null}

      {orgDisputes.length ? (
        <>
          <Banner kind="crit">
            <b>{orgDisputes.length} dispute{orgDisputes.length === 1 ? '' : 's'} need your decision.</b>
          </Banner>
          <MatchTable list={orgDisputes} />
        </>
      ) : null}

      {refOpen.length ? (
        <>
          <span className="tag"><em>//</em> You are officiating — waiting on you · {refOpen.length}</span>
          <div className="refgrid">
            {(Object.keys(REF_BUCKETS) as Bucket[]).map(k => (
              <div className="vstack" style={{ gap: 12 }} key={k}>
                <span className="tag"><em>//</em> {REF_BUCKETS[k].label} · {grouped[k].length}</span>
                {grouped[k].length
                  ? (
                    <div className="vstack" style={{ gap: 12 }}>
                      {grouped[k].map(m => <RefCard key={m.id} m={m} tr={tour(s, m.tour)!} onPick={() => setQuick(m)} />)}
                    </div>
                  )
                  : <span className="refempty">{REF_BUCKETS[k].empty}</span>}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {asRef.length ? (<><span className="tag"><em>//</em> You are officiating — every match · {asRef.length}</span><MatchTable list={asRef} /></>) : null}
      {asPlayer.length ? (<><span className="tag"><em>//</em> Your squad plays · {asPlayer.length}</span><MatchTable list={asPlayer} /></>) : null}
      {asOrg.length ? (<><span className="tag"><em>//</em> You run this tournament · {asOrg.length}</span><MatchTable list={asOrg} /></>) : null}

      {!asRef.length && !asPlayer.length && !asOrg.length ? (
        <Empty icon="match" title="Nothing on your fixture list"
          sub="Matches appear once a bracket you are part of is drawn." />
      ) : null}

      <Modal open={!!quick} onClose={() => setQuick(null)}>
        {quick ? <RefQuickCard m={quick} onClose={() => setQuick(null)} /> : null}
      </Modal>
    </>
  )
}
