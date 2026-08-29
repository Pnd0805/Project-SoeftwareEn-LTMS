/**
 * src/features/tournament/EntryPanel.tsx
 *
 * Entry, read from the tournament rather than from the squad. A leader who has
 * just read the rules and the entry notes is already here; sending them to their
 * squad page to start again is the long way round to the same form.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Facts, Panel } from '../../components/kit/primitives'
import { useLtms } from '../../shared/store'
import { me, regsOf, squadsFor, team } from '../../shared/selectors'
import { minSquad, regWindowClosed, ruleSummary, teamReady } from '../../shared/rules'
import type { Tournament } from '../../shared/types'
import { RegisterForm } from './RegisterForm'

export function EntryPanel({ t }: { t: Tournament }) {
  const s = useLtms()
  const u = me(s)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const approved = regsOf(s, t.id).filter(r => r.status === 'approved').length
  const closed = t.drawn ? 'The bracket is drawn — entries are closed.'
    : t.status !== 'public' ? 'Not open for registration yet.'
      : approved >= t.cap ? `Full at ${t.cap} squads.`
        : regWindowClosed(t)

  /* every squad of mine already in this one, whatever the organizer decided */
  const mineIn = u
    ? s.registrations.filter(r => r.tour === t.id && r.status !== 'withdrawn' && team(s, r.team)?.leader === u.id)
    : []
  const can = u ? squadsFor(s, t).filter(teamReady) : []
  const forming = u ? squadsFor(s, t).filter(x => !teamReady(x)) : []

  return (
    <>
      <Panel>
        <div className="spread">
          <span className="tag"><em>//</em> Entry</span>
          {closed
            ? <Badge kind="neutral">{t.drawn ? 'Closed' : approved >= t.cap ? 'Full' : 'Not open'}</Badge>
            : <Badge kind="ok">Open</Badge>}
        </div>
        <Facts rows={[
          ['Squads in', <><b className="num">{approved}</b> <span className="sub">of {t.cap}</span></>],
          ['Entry rules', ruleSummary(t.rules) || 'open to everybody'],
        ]} />

        {mineIn.map(r => (
          <div className="spread" key={r.id}>
            <span className="sub">{team(s, r.team)?.name}</span>
            {r.status === 'approved' ? <Badge kind="ok">In</Badge>
              : r.status === 'rejected' ? <Badge kind="crit">Rejected by the hard filter</Badge>
                : <Badge kind="warn">Waiting on the organizer</Badge>}
          </div>
        ))}

        {closed ? null : !u ? (
          <div className="hstack">
            <button className="btn primary" type="button" onClick={() => navigate('/login')}>Sign in to enter a squad</button>
          </div>
        ) : can.length ? (
          <div className="hstack">
            <button className="btn primary" type="button" onClick={() => setOpen(true)}>Register a squad</button>
          </div>
        ) : forming.length ? (
          <div className="sub">
            {forming[0].name} is still Forming — it needs {minSquad(forming[0])} players before it can enter.
          </div>
        ) : null}
      </Panel>

      {open && can.length ? (
        <RegisterForm team={can[0]} options={[t]} tournament={t} open={open} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}
