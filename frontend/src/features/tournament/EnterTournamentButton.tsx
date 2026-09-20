/**
 * src/features/tournament/EnterTournamentButton.tsx
 *
 * ประตูที่สองของการสมัครแข่ง — เริ่มจาก "ทีม" แทนที่จะเริ่มจาก "รายการแข่ง"
 * (ประตูแรกคือปุ่ม Register a squad ในหน้าทัวร์นาเมนต์ · ดูหัวไฟล์ RegisterForm.tsx)
 *
 * หัวหน้าทีมที่ทีมพร้อมแข่งแล้ว กดที่นี่แล้วเลือกรายการที่ยังเปิดรับสมัคร
 * ในกีฬาเดียวกับทีมได้เลย ไม่ต้องไล่หาเองจากหน้ารวมรายการ
 *
 * backend: GET /tournaments (คืนเฉพาะรายการที่ publish แล้ว พร้อม registrationOpen)
 *          GET /me/applications (กันไม่ให้เสนอรายการที่ทีมนี้สมัครไปแล้ว)
 * โหมด mock ไม่ใช้ตัวนี้ — ข้อมูลของ prototype อยู่ใน store คนละชุดกับ api/tournament.ts
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyTournamentApplications, useTournaments } from '../../hooks/useTournament'
import { tournamentView } from './tournamentView'
import { useSportTypes } from '../../hooks/useReference'
import { RegisterForm } from './RegisterForm'

export function EnterTournamentButton({ team, variant = 'ghost' }: {
  team: { id: number; name: string; sportTypeId: number }
  variant?: 'ghost' | 'primary'
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const tournaments = useTournaments()
  const applications = useMyTournamentApplications()
  const sportTypes = useSportTypes()

  /* รายการที่ทีมนี้สมัครไปแล้ว (และยังไม่ถอน) ไม่ต้องเสนอซ้ำ — backend ตอบ 409 ALREADY_APPLIED */
  const entered = new Set(
    (applications.data?.items ?? [])
      .filter(a => a.team.id === team.id && a.status !== 'withdrawn' && a.status !== 'cancelled')
      .map(a => a.tournament.id),
  )

  const options = (tournaments.data?.items ?? [])
    .filter(dto => dto.registrationOpen && dto.sportTypeId === team.sportTypeId && !entered.has(dto.id))
    .map(dto => tournamentView(dto, [], [], sportTypes.data?.items ?? []))

  if (tournaments.isPending) {
    return <button className={`btn ${variant}`} type="button" disabled>Loading tournaments…</button>
  }

  if (!options.length) {
    return (
      <button className={`btn ${variant}`} type="button" onClick={() => navigate('/')}>
        No open tournament in this sport — browse them all
      </button>
    )
  }

  return (
    <>
      <button className={`btn ${variant}`} type="button" onClick={() => setOpen(true)}>
        Register for a tournament
      </button>
      {open ? (
        <RegisterForm
          options={options}
          tournament={options[0]}
          sportTypeId={team.sportTypeId}
          backendTeam={{ id: team.id, name: team.name }}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
