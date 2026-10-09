/**
 * src/features/tournament/manage/ManageTab.tsx
 *
 * Everything scoped to the one person who runs this tournament. Organizer is
 * granted per tournament, so the parent page refuses this tab out loud rather
 * than quietly swapping in the bracket.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Panel, TableWrap } from '../../../components/kit/primitives'
import { ManageActivity } from './ManageActivity'
import { USE_MOCK } from '../../../api/client'
import { useLtms } from '../../../shared/store'
import { user } from '../../../shared/selectors'
import { fmtDate, formatOf } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'
import { feedbackOf } from '../CommunityTab'
import { DeleteTournamentPanel } from './DeleteTournamentPanel'
import { DrawPanel } from './DrawPanel'
import { EntryFilterPanel } from './EntryFilterPanel'
import { MatchRefereePlanner } from './MatchRefereePlanner'
import { RefereeFinder, RefereePanel } from './RefereePanel'
import { RegistrationsPanel } from './RegistrationsPanel'
import { SetupTrail } from './SetupTrail'
import { LiveFeedbackPanel } from './LiveFeedbackPanel'
import { OrganizerWithdrawals } from '../../match/RefereeWithdrawal'

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
  return <ManageWorkspace key={t.id} t={t} sub={sub} />
}

function ManageWorkspace({ t, sub }: { t: Tournament; sub?: string }) {
  const [finder, setFinder] = useState<string | null>(null)
  /* id ของ store เป็น string — แผงที่คุยกับ API ต้องได้เลขเท่านั้น */
  const liveTournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  const showDraw = formatOf(t) !== 'roundrobin'
  const subtabs = ['progress', 'registrations', 'entry', ...(showDraw ? ['draw'] : []), 'referees', 'feedback']
  const active = subtabs.includes(sub ?? '') ? sub! : 'registrations'
  const [visited, setVisited] = useState<string[]>([active])
  /* ไม่ mount ทุกแผงพร้อมกัน เพราะบางแผงอ่านข้อมูลส่วนตัวเมื่อเปิดครั้งแรก */
  if (!visited.includes(active)) setVisited([...visited, active])

  return (
    <div className="organizer-workspace">
      <nav className="tabs organizer-tabs" aria-label="Manage sections">
        {subtabs.map(k => <Link key={k} to={`/t/${t.id}/manage/${k}`} className={`tab ${k === active ? 'on' : ''}`}
          aria-current={k === active ? 'page' : undefined} aria-controls={`manage-${k}`}
          >{LABELS[k]}</Link>)}
      </nav>
      {subtabs.filter(k => visited.includes(k)).map(k => <ManageActivity.Provider key={k} value={active === k}>
        <section id={`manage-${k}`} className="organizer-section" aria-label={LABELS[k]} hidden={active !== k} inert={active !== k}>
      {k === 'progress' ? <><SetupTrail t={t} onAppoint={() => setFinder(k)} />{!USE_MOCK ? <DeleteTournamentPanel t={t} /> : null}</> : null}
      {k === 'registrations' ? <RegistrationsPanel t={t} /> : null}
      {k === 'entry' ? <EntryFilterPanel t={t} /> : null}
      {/* จับสายเสร็จแล้วงานถัดไปคือหาคนคุมทุกนัด — R10: ต้องทำได้ตรงนี้เลย รวมถึงนัด
          รอบหลังที่ยังไม่รู้คู่ ไม่ใช่ไล่เปิดหน้า Fixture ทีละแมตช์ (โหมด mock ไม่มีเส้น
          FR02 ให้เรียก แผงนี้จึงขึ้นเฉพาะทัวร์ที่มาจาก API) */}
      {k === 'draw' ? <DrawPanel t={t} /> : null}
      {k === 'draw' && !USE_MOCK ? <MatchRefereePlanner tournamentId={liveTournamentId} /> : null}
      {k === 'referees' ? <><RefereePanel t={t} onAppoint={() => setFinder(k)} />
        {!USE_MOCK && liveTournamentId ? <OrganizerWithdrawals tournamentId={liveTournamentId} /> : null}
        {!showDraw && !USE_MOCK ? <MatchRefereePlanner tournamentId={liveTournamentId} /> : null}</> : null}
      {k === 'feedback' ? USE_MOCK ? <FeedbackPanel t={t} /> : <LiveFeedbackPanel tournamentId={liveTournamentId!} /> : null}
        </section>
      </ManageActivity.Provider>)}
      <RefereeFinder t={t} open={finder === active} onClose={() => setFinder(null)} />
    </div>
  )
}
