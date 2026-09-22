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
import { minSquad, ruleSummary, teamReady } from '../../shared/rules'
import type { Tournament } from '../../shared/types'
import type { TournamentApplicationDto } from '../../types/tournament.dto'
import { USE_MOCK } from '../../api/client'
import { useMe } from '../../hooks/useAuth'
import { useBackendMyTeams } from '../../hooks/useTeam'
import { useMyTournamentApplications } from '../../hooks/useTournament'
import { RegisterForm } from './RegisterForm'
import { registrationClosedReason } from './tournamentView'

/**
 * ใครสมัครได้: โหมด mock อ่านจาก store · โหมดจริงอ่านจาก backend
 *   ตัวตน       → GET /me            (store ไม่มี session ในโหมดจริง)
 *   ทีมที่นำอยู่ → GET /me/teams      (ต้องเป็นหัวหน้าทีม · Ready · กีฬาตรงกับรายการ)
 *   ใบสมัครเดิม → GET /me/applications
 * เดิมหน้านี้อ่านจาก store อย่างเดียว หัวหน้าทีมในโหมดจริงจึงไม่เห็นปุ่มสมัครเลย
 */
export function EntryPanel({ t, applications, approvedCount, sportTypeId }: {
  t: Tournament
  applications?: TournamentApplicationDto[]
  /** ยอดทีมที่ผู้จัดอนุมัติแล้ว จาก GET /tournaments/:id/teams (โหมดจริงเท่านั้น) */
  approvedCount?: number
  sportTypeId?: number
}) {
  const s = useLtms()
  const storeUser = me(s)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const meQuery = useMe()
  const backendTeams = useBackendMyTeams()
  const myApplications = useMyTournamentApplications()
  const u = USE_MOCK ? storeUser : (meQuery.data ? { id: String(meQuery.data.id) } : null)

  /* ลำดับความน่าเชื่อ: ยอดจาก backend → ใบสมัครที่ส่งมาด้วย → store
     GET /tournaments/:id ไม่มี applications ให้ ถ้าไม่รับ approvedCount มาด้วย
     โหมดจริงจะตกมานับจาก store ที่ว่างเปล่าแล้วขึ้น 0 ตลอด */
  const approved = approvedCount
    ?? (applications
      ? applications.filter(application => application.status === 'approved').length
      : regsOf(s, t.id).filter(r => r.status === 'approved').length)
  const closed = registrationClosedReason(t, approved, !USE_MOCK)

  /* every squad of mine already in this one, whatever the organizer decided */
  const mineIn = USE_MOCK && u
    ? s.registrations.filter(r => r.tour === t.id && r.status !== 'withdrawn' && team(s, r.team)?.leader === u.id)
    : []
  const can = USE_MOCK && u ? squadsFor(s, t).filter(teamReady) : []
  const forming = USE_MOCK && u ? squadsFor(s, t).filter(x => !teamReady(x)) : []

  /* โหมดจริง — ทีมที่เรานำอยู่และพร้อมแข่งในกีฬาเดียวกับรายการนี้ */
  const myTeams = USE_MOCK ? [] : (backendTeams.data?.items ?? [])
    .filter(x => x.role === 'leader' && (sportTypeId === undefined || x.sportTypeId === sportTypeId))
  const backendReady = myTeams.filter(x => x.readinessStatus === 'Ready')
  const backendForming = myTeams.filter(x => x.readinessStatus !== 'Ready')
  const backendEntries = USE_MOCK ? [] : (myApplications.data?.items ?? [])
    .filter(a => a.tournament.id === Number(t.id) && a.status !== 'withdrawn' && a.status !== 'cancelled')

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

        {backendEntries.map(a => (
          <div className="spread" key={a.id}>
            <span className="sub">{a.team.name}</span>
            {a.status === 'approved' ? <Badge kind="ok">In</Badge>
              : a.status === 'rejected' ? <Badge kind="crit">{a.rejectionReason ?? 'Rejected'}</Badge>
                : <Badge kind="warn">Waiting on the organizer</Badge>}
          </div>
        ))}

        {closed ? null : !u ? (
          <div className="hstack">
            <button className="btn primary" type="button" onClick={() => navigate('/login')}>Sign in to enter a squad</button>
          </div>
        ) : can.length || backendReady.length ? (
          <div className="hstack">
            <button className="btn primary" type="button" onClick={() => setOpen(true)}>Register a squad</button>
          </div>
        ) : forming.length ? (
          <div className="sub">
            {forming[0].name} is still Forming — it needs {minSquad(forming[0])} players before it can enter.
          </div>
        ) : backendForming.length ? (
          <div className="sub">
            {backendForming[0].name} is still Forming — it needs more players before it can enter.
          </div>
        ) : !USE_MOCK && backendTeams.isPending ? (
          <div className="sub">Loading the squads you lead…</div>
        ) : !USE_MOCK ? (
          <div className="sub">You need a squad you lead, in this sport, with Ready status before you can enter.</div>
        ) : null}
      </Panel>

      {open && (can.length || backendReady.length) ? (
        <RegisterForm team={can[0]} options={[t]} tournament={t} sportTypeId={sportTypeId}
          open={open} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}
