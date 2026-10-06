import { Link } from 'react-router-dom'
import { Banner } from '../../../components/kit/primitives'
import { useRefereeCoverage, useTournamentReferees } from '../../../hooks/useAdmin'
import { useTournamentMatches } from '../../../hooks/useMatch'

/** F14 exposes counts and this tournament's matches, never another organizer's schedule. */
export function RefereeCoverageWarnings({ tournamentId, matchId }: { tournamentId: number; matchId?: number }) {
  const coverage = useRefereeCoverage(tournamentId)
  const pool = useTournamentReferees(tournamentId)
  const matches = useTournamentMatches(tournamentId)
  if (coverage.isError) return <Banner kind="crit">
    <b>ตรวจตารางกรรมการไม่สำเร็จ</b> {coverage.error instanceof Error ? coverage.error.message : ''}
    <button className="btn" type="button" onClick={() => void coverage.refetch()}>Retry</button>
  </Banner>
  if (!coverage.data) return <p className="sub">กำลังตรวจตารางกรรมการ…</p>
  const rows = (coverage.data.crossTournamentConflicts ?? []).filter(row => matchId === undefined || row.matchId === matchId)
  if (!rows.length) return null
  const when = (iso: string | null | undefined) => iso && Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ยังไม่มีเวลา'
  return <Banner kind="warn">
    <div className="vstack">
      <b>กรรมการมีงานนอกทัวร์นี้ทับเวลา</b>
      <span>ติดต่อกรรมการเพื่อเลื่อนเวลาแมตช์หรือเปลี่ยนกรรมการ การแจ้งเตือนนี้ไม่บล็อกการจัดตาราง</span>
      {rows.map(row => {
        const referee = pool.data?.items.find(r => r.user.id === row.userId)
        const match = matches.data?.items.find(m => m.id === row.matchId)
        return <div className="vstack" key={`${row.userId}-${row.matchId}`}>
          <span><b>{referee?.user.fullName ?? `กรรมการ #${row.userId}`}</b> — มีงานนอกทัวร์นี้ทับอยู่ {row.conflictCount} แมตช์</span>
          <span>แมตช์ #{row.matchId}{match ? ` · รอบ ${match.roundNumber ?? '—'} · ${when(match.scheduledTime)} – ${when(match.scheduledEndTime)} (UTC+7)` : ''}</span>
          <div className="hstack">
            <Link className="btn" to={`/m/${row.matchId}/fixture`}>เลื่อนเวลาแมตช์</Link>
            <Link className="btn" to={`/m/${row.matchId}/fixture#referee-assignments`}>เปลี่ยนกรรมการ</Link>
          </div>
        </div>
      })}
      {pool.isError || matches.isError ? <div>
        โหลดชื่อกรรมการหรือรายละเอียดแมตช์ไม่สำเร็จ ยังแสดงคำเตือนตามรหัสได้
        <button className="btn" type="button" onClick={() => { void pool.refetch(); void matches.refetch() }}>Retry details</button>
      </div> : null}
    </div>
  </Banner>
}
