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
 */
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
  const overall = stats.data?.overall
  const bySport = stats.data?.bySport ?? []

  return (
    <>
      <Crumb back={{ label: 'Tournaments', onClick: () => navigate('/') }}>{p.fullName}</Crumb>

      <div className="spread">
        <span className="hstack" style={{ gap: 16 }}>
          <span className="avatar" style={{ width: 60, height: 60, fontSize: 26 }}>{p.fullName.slice(0, 1)}</span>
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
            onClick={() => follow.toggle.mutate()} disabled={follow.toggle.isPending}>
            {follow.isFollowing ? 'Following' : 'Follow this player'}
          </button>
        ) : null}
      </div>

      <Panel quiet>
        <span className="tag"><em>//</em> Squads · {p.teams.length}</span>
        {p.teams.length ? (
          <div className="hstack" style={{ flexWrap: 'wrap', gap: 8 }}>
            {p.teams.map(team => (
              <button className="btn ghost" type="button" key={team.id}
                onClick={() => navigate(`/team/${team.id}`)}>
                {team.name} <Icon name="chev" size={11} />
              </button>
            ))}
          </div>
        ) : <div className="sub">Not in any squad yet.</div>}
      </Panel>

      <Panel quiet>
        <span className="tag"><em>//</em> Career — never summed across sports</span>
        {stats.isPending ? <div className="sub">Loading figures…</div> : null}
        {overall ? (
          <div className="statline">
            <div><span className="tag">Played</span><span className="v">{overall.matchesPlayed}</span></div>
            <div><span className="tag">Won</span><span className="v">{overall.wins}</span></div>
            <div><span className="tag">Lost</span><span className="v">{overall.losses}</span></div>
            <div><span className="tag">Win rate</span><span className="v">{Math.round(overall.winRate * 100)}%</span></div>
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
        ) : stats.isSuccess ? (
          <div className="sub">Nothing recorded yet — figures appear once a referee confirms a match they played in.</div>
        ) : null}
      </Panel>
    </>
  )
}
