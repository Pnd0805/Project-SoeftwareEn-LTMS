/**
 * src/features/player/BackendPlayerProfile.tsx
 *
 * โปรไฟล์ผู้เล่นในโหมดที่ต่อ backend จริง — คนละแหล่งกับหน้าของ prototype
 * ที่อ่านจาก store (ดู PlayerPage.tsx)
 *
 * backend: GET /users/:id        → ชื่อ คณะ ภาควิชา และทีมที่สังกัด
 *          GET /users/:id/stats  → สถิติรวมและแยกตามกีฬา
 *
 * ⚠️ โปรไฟล์สาธารณะของ backend ไม่ส่งวันเกิด ชั้นปี หรืออีเมลมาให้ (PDPA — NF-SE-03)
 *    หน้านี้จึงไม่มีอายุกับชั้นปีเหมือนหน้าของ prototype และไม่ควรเดาเอาเอง
 *
 * OD-46 — เจ้าของปิดสถิติได้ (`statsHidden` บน U03 ตั้งแต่ request แรก) ⇒ U04/U14 ตอบ 200 แต่ช่องเป็น null
 *   บอกว่าซ่อนไว้ ไม่ใช่ "ยังไม่มีอะไร" · สถิติในแต่ละทัวร์ (RW06) ยังเปิดเสมอ ไม่ได้ปิดตาม
 * OD-60 — MVP ใช้ mvpTimes เป็นตัวหลัก · mvpVotes โตตามจำนวนคนดู ห้ามติดป้ายว่า "MVP"
 */
import { BackendCareerPanel } from './BackendCareerPanel'
import { Avatar } from '../../components/kit/Avatar'
import { useNavigate } from 'react-router-dom'
import { Badge, Crumb, Empty, Panel, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { useMe } from '../../hooks/useAuth'
import { useFollow, usePublicUser, useUserStats } from '../../hooks/useUser'
import { useDepartments, useFaculties } from '../../hooks/useReference'

export function BackendPlayerProfile({ userId }: { userId: number | undefined }) {
  const navigate = useNavigate()
  const profile = usePublicUser(userId)
  const stats = useUserStats(userId)
  const faculties = useFaculties()
  const departments = useDepartments(profile.data?.facultyId)
  const { data: currentUser } = useMe()
  const follow = useFollow(currentUser?.id, `player:${userId ?? ''}`)

  if (userId === undefined) {
    return (
      <Empty icon="user" title="Invalid player link"
        sub="That link points at prototype data, which only exists in mock mode.">
        <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
      </Empty>
    )
  }

  if (profile.isPending) return <Panel><span className="sub">Loading profile…</span></Panel>

  if (profile.isError || !profile.data) {
    const status = (profile.error as { status?: number } | null)?.status
    return (
      <Empty icon="user" title={status === 404 ? 'No such player' : 'Could not load this profile'}>
        <p className="sub">{(profile.error as Error | null)?.message ?? ''}</p>
        <button className="btn" type="button" onClick={() => void profile.refetch()}>Try again</button>
      </Empty>
    )
  }

  const p = profile.data
  const facultyName = faculties.data?.items.find(f => f.id === p.facultyId)?.name
  const departmentName = departments.data?.items.find(d => d.id === p.departmentId)?.name
  const hidden = !!p.statsHidden || !!stats.data?.statsHidden
  const overall = hidden ? null : stats.data?.overall
  const bySport = hidden ? [] : stats.data?.bySport ?? []
  const mvpTimes = stats.data?.mvpTimes
  const mvpVotes = stats.data?.mvpVotes

  return (
    <>
      <Crumb back={{ label: 'Tournaments', onClick: () => navigate('/') }}>{p.fullName}</Crumb>

      <div className="spread">
        <span className="hstack" style={{ gap: 16 }}>
          <Avatar name={p.fullName} avatarUrl={p.avatarUrl} size={60} alt={p.fullName} />
          <span className="vstack" style={{ gap: 5 }}>
            <span className="disp" style={{ fontSize: 30 }}>{p.fullName}</span>
            <span className="hstack">
              {facultyName ? <span className="tag">{facultyName}</span> : null}
              {departmentName ? <span className="tag">{departmentName}</span> : null}
              {overall?.championCount ? <Badge kind="ok">{`${overall.championCount} title${overall.championCount === 1 ? '' : 's'}`}</Badge> : null}
            </span>
          </span>
        </span>
        {currentUser && currentUser.id !== p.id ? (
          <button className={`btn ${follow.isFollowing ? 'ghost' : 'primary'}`} type="button"
            onClick={() => follow.toggle.mutate()} disabled={follow.isLoading || !!follow.error || follow.toggle.isPending}>
            {follow.isFollowing ? 'Following' : 'Follow this player'}
          </button>
        ) : null}
      </div>

      {follow.error || follow.toggle.error ? <p role="alert">{(follow.error ?? follow.toggle.error) instanceof Error ? (follow.error ?? follow.toggle.error as Error)?.message : "Following request failed."}</p> : null}
      <Panel quiet>
        <span className="tag"><em>//</em> Squads · {p.teams.length}</span>
        {p.teams.length ? (
          <div className="hstack" style={{ flexWrap: 'wrap', gap: 8 }}>
            {p.teams.map(team => (
              <button className="btn ghost" type="button" key={team.id}
                onClick={() => navigate(`/team/${team.id}`)}>
                {team.logoUrl ? <img src={team.logoUrl} alt="" width={16} height={16} style={{ borderRadius: 4, objectFit: 'cover' }} /> : null}
                {team.name} <Icon name="chev" size={11} />
              </button>
            ))}
          </div>
        ) : <div className="sub">Not in any squad yet.</div>}
      </Panel>

      <Panel quiet>
        <span className="tag"><em>//</em> Career — never summed across sports</span>
        {stats.isPending && !hidden ? <div className="sub">Loading figures…</div> : null}
        {hidden ? (
          <div className="sub">
            This player keeps their profile stats private. Their figures inside each tournament are
            still shown on that tournament&apos;s pages.
          </div>
        ) : null}
        {overall ? (
          <div className="statline">
            <div><span className="tag">Played</span><span className="v">{overall.matchesPlayed}</span></div>
            <div><span className="tag">Won</span><span className="v">{overall.wins}</span></div>
            <div><span className="tag">Lost</span><span className="v">{overall.losses}</span></div>
            <div><span className="tag">Win rate</span><span className="v">{Math.round(overall.winRate * 100)}%</span></div>
            {mvpTimes != null ? <div><span className="tag">MVP</span><span className="v">{mvpTimes}×</span></div> : null}
            {mvpVotes != null ? <div><span className="tag">MVP votes received</span><span className="v">{mvpVotes}</span></div> : null}
          </div>
        ) : null}
        {bySport.length ? (
          <TableWrap>
            <table>
              <thead><tr><th>Sport</th><th>Played</th><th>Won</th><th>Lost</th></tr></thead>
              <tbody>
                {bySport.map(row => (
                  <tr key={row.sportTypeId}>
                    <td>{row.sportName}</td>
                    <td className="num">{row.matchesPlayed}</td>
                    <td className="num">{row.wins}</td>
                    <td className="num">{row.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : stats.isSuccess && !hidden ? (
          <div className="sub">Nothing recorded yet — figures appear once a referee confirms a match they played in.</div>
        ) : null}
      </Panel>
      <BackendCareerPanel userId={userId} />
    </>
  )
}
