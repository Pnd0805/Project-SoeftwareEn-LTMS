/**
 * src/features/tournament/manage/ManageTab.tsx
 *
 * Everything scoped to the one person who runs this tournament. Organizer is
 * granted per tournament, so the parent page refuses this tab out loud rather
 * than quietly swapping in the bracket.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Panel, TableWrap, Tabs } from '../../../components/kit/primitives'
import { useLtms } from '../../../shared/store'
import { regsOf, user } from '../../../shared/selectors'
import { fmtDate, formatOf, refsNeeded } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'
import { feedbackOf } from '../CommunityTab'
import { DrawPanel } from './DrawPanel'
import { EntryFilterPanel } from './EntryFilterPanel'
import { RefereeFinder, RefereePanel } from './RefereePanel'
import { RegistrationsPanel } from './RegistrationsPanel'
import { SetupTrail } from './SetupTrail'

/** Written to the organizer, not published — the aggregate rating is the public half. */
function FeedbackPanel({ t }: { t: Tournament }) {
  const s = useLtms()
  const f = feedbackOf(s, t.id)
  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Feedback — written to you, not published</span>
        {f.count
          ? <Badge kind={f.avg >= 4 ? 'ok' : f.avg >= 3 ? 'warn' : 'crit'}>{`${f.avg} out of 5 · ${f.count}`}</Badge>
          : <Badge kind="neutral">Nothing yet</Badge>}
      </div>
      {f.count ? (
        <TableWrap>
          <table>
            <thead><tr><th>Rating</th><th>From</th><th>What they said</th><th>When</th></tr></thead>
            <tbody>
              {f.rows.slice().sort((a, b) => b.at - a.at).map(x => (
                <tr key={x.id}>
                  <td><Badge kind={x.rating >= 4 ? 'ok' : x.rating >= 3 ? 'warn' : 'crit'}>{`${x.rating}/5`}</Badge></td>
                  <td className="sub">{user(s, x.by)?.name ?? 'Unknown'}</td>
                  <td>{x.text}</td>
                  <td className="tag">{fmtDate(x.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}
    </Panel>
  )
}

const LABELS: Record<string, string> = {
  progress: 'Progress', registrations: 'Registrations', entry: 'Entry & filter',
  draw: 'Draw', referees: 'Referees', feedback: 'Feedback',
}

export function ManageTab({ t, sub }: { t: Tournament; sub?: string }) {
  const s = useLtms()
  const navigate = useNavigate()
  const [finder, setFinder] = useState(false)
  const approved = regsOf(s, t.id).filter(r => r.status === 'approved')
  const showDraw = formatOf(t) !== 'roundrobin'
  const subtabs = ['progress', 'registrations', 'entry', ...(showDraw ? ['draw'] : []), 'referees', 'feedback']
  const active = subtabs.includes(sub ?? '') ? sub! : 'registrations'

  return (
    <>
      <Tabs
        tabs={subtabs.map(k => ({ key: k, label: LABELS[k] }))}
        active={active}
        onPick={k => navigate(`/t/${t.id}/manage/${k}`)}
      />
      {active === 'progress' ? <SetupTrail t={t} onAppoint={() => setFinder(true)} /> : null}
      {active === 'registrations' ? <RegistrationsPanel t={t} /> : null}
      {active === 'entry' ? <EntryFilterPanel t={t} /> : null}
      {active === 'draw' ? <DrawPanel t={t} approved={approved} /> : null}
      {active === 'referees' ? <RefereePanel t={t} need={refsNeeded(t)} onAppoint={() => setFinder(true)} /> : null}
      {active === 'feedback' ? <FeedbackPanel t={t} /> : null}
      <RefereeFinder t={t} open={finder} onClose={() => setFinder(false)} />
    </>
  )
}
