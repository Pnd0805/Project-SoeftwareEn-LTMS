/**
 * The signed-in user's profile. Real mode is rendered exclusively from API
 * DTOs; prototype-only career data remains available in mock mode.
 */
import { BackendCareerPanel } from '../player/BackendCareerPanel'
import { BackendMatchHistoryPanel } from '../player/BackendMatchHistoryPanel'
import { Link } from 'react-router-dom'
import { USE_MOCK } from '../../api/client'
import { Badge, Empty, Facts, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamLink, TeamLinkView } from '../../components/kit/chips'
import { useState } from 'react'
import { useMe, useUpdateMe } from '../../hooks/useAuth'
import { Icon } from '../../components/kit/Icon'
import { IMAGE_ACCEPT, shrinkImage } from '../../mocks/imageInput'
import { uploadImage, UPLOAD_IMAGE_ACCEPT, imageUploadErrorMessage } from '../../api/upload'
import { Avatar } from '../../components/kit/Avatar'
import type { MeDto } from '../../types/dto'
import { useDepartments, useFaculties, useSportTypes } from '../../hooks/useReference'
import { useBackendMyTeams } from '../../hooks/useTeam'
import { useFollows, useUserStats } from '../../hooks/useUser'
import { usePickemHistory } from '../../hooks/useLiveEngagement'
import { careerByTournament, pickScore } from '../../shared/career'
import { ageOf } from '../../shared/rules'
import { tour } from '../../shared/selectors'
import { useLtms } from '../../shared/store'
import { CareerPanel } from '../player/PlayerPage'
import { ExternalIdentityBadge, ExternalIdentityPanel } from './ExternalIdentityPanel'

export function ProfilePage() {
  const s = useLtms()
  const meQuery = useMe()
  const currentUser = meQuery.data
  const statsQuery = useUserStats(currentUser?.id)
  const followsQuery = useFollows(currentUser?.id)
  const teamsQuery = useBackendMyTeams()
  const facultiesQuery = useFaculties()
  const departmentsQuery = useDepartments(currentUser?.facultyId)
  const sportsQuery = useSportTypes()
  const pickem = usePickemHistory(!USE_MOCK && !!currentUser)

  if (meQuery.isPending) {
    return <Panel quiet><span className="sub">Loading your profile…</span></Panel>
  }

  if (meQuery.isError || !currentUser) {
    return <Empty icon="user" title="Unable to load your profile" sub="Sign in again or retry when the server is available." />
  }

  if (USE_MOCK) {
    const legacyUser = s.users.find(user => user.email === currentUser.email)
    if (!legacyUser) {
      return <Empty icon="user" title="Profile data is unavailable" sub="The signed-in account is not present in the mock dataset." />
    }

    const userStats = statsQuery.data
    const byTour = careerByTournament(s, legacyUser.id)
    const picks = pickScore(s, legacyUser.id)
    const squads = s.teams.filter(team => team.members.includes(legacyUser.id))
    const mvpVotes = s.votes.filter(vote => vote.player === legacyUser.id).length
    const follows = followsQuery.data?.targets ?? []

    return (
      <>
        <ProfileHeading
          label={legacyUser.role === 'Admin' ? 'Administrator' : legacyUser.external ? 'External' : 'Student record'}
          user={currentUser}
          isExternal={Boolean(legacyUser.external || currentUser.userType === 'external')}
        />
        {statsQuery.isPending ? <Panel quiet><span className="sub">Loading statistics…</span></Panel> : null}
        {statsQuery.isError ? <Empty title="Statistics are unavailable" sub="Your identity loaded, but the statistics request failed." /> : null}
        {userStats?.overall ? (
          <div className="statline">
            <Stat label="Matches played" value={userStats.overall.matchesPlayed} />
            <Stat label="Won" value={userStats.overall.wins} />
            <Stat label="Titles" value={userStats.overall.championCount} />
            <Stat label="Tokens" value={picks.tokens} />
          </div>
        ) : null}

        <div className="split">
          <div>
            <CareerPanel pid={legacyUser.id} />
            <Panel quiet>
              <span className="tag"><em>//</em> Pick'em</span>
              <div className="statline">
                <Stat label="Calls made" value={picks.total} />
                <Stat label="Correct" value={picks.right} />
                <Stat label="Held" value={picks.held} />
              </div>
            </Panel>
            <Panel quiet>
              <span className="tag"><em>//</em> Squads · {squads.length}</span>
              {squads.length ? (
                <TableWrap><table><thead><tr><th>Squad</th><th>Role</th><th>Sport</th></tr></thead><tbody>
                  {squads.map(team => <tr key={team.id}><td><TeamLink id={team.id} /></td><td className="sub">{team.leader === legacyUser.id ? 'Leader' : 'Player'}</td><td className="sub">{team.sport ?? '—'}</td></tr>)}
                </tbody></table></TableWrap>
              ) : <div className="sub">Not in a squad yet.</div>}
            </Panel>
            {byTour.length ? (
              <Panel quiet><span className="tag"><em>//</em> Tournaments</span><TableWrap><table>
                <thead><tr><th>Tournament</th><th>Sport</th><th>Played</th><th>Finish</th></tr></thead>
                <tbody>{byTour.map(row => <tr key={row.tour}><td>{tour(s, row.tour)?.name ?? row.name}</td><td><Badge kind="neutral">{row.sport}</Badge></td><td className="num">{row.p}</td><td className="sub">{row.finish}</td></tr>)}</tbody>
              </table></TableWrap></Panel>
            ) : null}
          </div>
          <div className="rail">
            <Panel><span className="tag"><em>//</em> {legacyUser.external ? 'External record' : 'Student record — the registry owns this'}</span><Facts rows={[
              ['Faculty', legacyUser.faculty], ['Major', legacyUser.major], ['Year', String(currentUser.year)],
              ['Age', String(ageOf(currentUser.birthDate))], ['Gender', currentUser.gender], ['Role', currentUser.userType === 'staff' ? 'Admin' : (currentUser.userType === 'external' || legacyUser.external) ? 'External' : 'User'],
            ]} /></Panel>
            <Panel quiet><span className="tag"><em>//</em> Following · {follows.length}</span>{follows.length ? follows.map(key => <div className="sub" key={key}>{key.replace('team:', 'Squad · ').replace('player:', 'Player · ')}</div>) : <span className="sub">Nothing followed yet.</span>}</Panel>
            <Panel quiet><span className="tag"><em>//</em> MVP votes received</span><span className="v" style={{ fontFamily: 'var(--f-display)', fontSize: 30, color: 'var(--teal)' }}>{mvpVotes}</span></Panel>
          </div>
        </div>
      </>
    )
  }

  const faculty = facultiesQuery.data?.items.find(item => item.id === currentUser.facultyId)?.name
  const department = departmentsQuery.data?.items.find(item => item.id === currentUser.departmentId)?.name
  const sports = new Map((sportsQuery.data?.items ?? []).map(item => [item.id, item.name]))
  const stats = statsQuery.data
  const teams = teamsQuery.data?.items ?? []

  return (
    <>
      <ProfileHeading
        label={currentUser.userType === 'staff' ? 'Administrator' : currentUser.userType === 'external' ? 'External' : 'Student record'}
        user={currentUser}
        isExternal={currentUser.userType === 'external'}
      />
      {currentUser.userType === 'external' ? <ExternalIdentityPanel /> : null}

      {statsQuery.isPending ? <Panel quiet><span className="sub">Loading statistics…</span></Panel> : null}
      {statsQuery.isError ? <Empty title="Statistics are unavailable" sub="Your account details are still available below. Retry when the server is ready." /> : null}
      {/* OD-46 — overall/bySport เป็น null ได้เมื่อสถิติถูกซ่อน (เจ้าตัวเห็นของตัวเองเสมอ แต่ type ต้องกันไว้) */}
      {stats?.overall ? (
        <>
          <div className="statline">
            <Stat label="Matches played" value={stats.overall.matchesPlayed} />
            <Stat label="Won" value={stats.overall.wins} />
            <Stat label="Titles" value={stats.overall.championCount} />
            <Stat label="Points" value={currentUser.totalPoints} />
          </div>
          {stats.bySport?.length ? (
            <Panel quiet><span className="tag"><em>//</em> Statistics by sport</span><TableWrap><table>
              <thead><tr><th>Sport</th><th>Played</th><th>Wins</th><th>Losses</th></tr></thead>
              <tbody>{stats.bySport.map(row => <tr key={row.sportTypeId}><td>{row.sportName}</td><td className="num">{row.matchesPlayed}</td><td className="num">{row.wins}</td><td className="num">{row.losses}</td></tr>)}</tbody>
            </table></TableWrap></Panel>
          ) : null}
        </>
      ) : null}

      <div className="split">
        <div>
          <Panel quiet>
            <span className="tag"><em>//</em> Squads · {teams.length}</span>
            {teamsQuery.isPending ? <span className="sub">Loading squads…</span> : null}
            {teamsQuery.isError ? <Empty icon="team" title="Unable to load squads" sub="The profile is available, but the squad request failed." /> : null}
            {!teamsQuery.isPending && !teamsQuery.isError && !teams.length ? <Empty icon="team" title="Not in a squad yet" sub="Create a squad or accept an invitation from the Teams page." /> : null}
            {teams.length ? (
              <TableWrap><table><thead><tr><th>Squad</th><th>Role</th><th>Sport</th><th>Members</th></tr></thead><tbody>
                {teams.map(team => <tr key={team.id}><td><TeamLinkView team={team} /></td><td className="sub">{team.role === 'leader' ? 'Leader' : 'Player'}</td><td className="sub">{sports.get(team.sportTypeId) ?? `Sport #${team.sportTypeId}`}</td><td className="num">{team.memberCount}</td></tr>)}
              </tbody></table></TableWrap>
            ) : null}
          </Panel>
          <Panel quiet>
            <span className="tag"><em>//</em> Pick'em history</span>
            {pickem.isPending ? <span className="sub">Loading predictions…</span> : null}
            {pickem.isError ? <Empty title="Pick'em history is unavailable" sub="Please try again later." /> : null}
            {pickem.data ? <>
              <div className="statline"><Stat label="Points" value={pickem.data.totalPoints} />
                <Stat label="Correct" value={pickem.data.correct} /><Stat label="Settled" value={pickem.data.settled} /></div>
              {pickem.data.items.length ? pickem.data.items.map(item => <div className="spread" key={item.matchId}>
                <Link to={`/m/${item.matchId}`}>{item.tournament.name} · {item.teamA?.name ?? 'TBD'} vs {item.teamB?.name ?? 'TBD'}</Link>
                <span>{item.status} · {item.pointsEarned ?? '—'} points</span>
              </div>) : <p className="sub">No predictions yet.</p>}
            </> : null}
          </Panel>
          <BackendCareerPanel userId={currentUser.id} />
          <BackendMatchHistoryPanel userId={currentUser.id} />
          <Panel quiet><span className="tag"><em>//</em> MVP totals</span>
            {stats?.mvpTimes != null ? <Stat label="MVP awards" value={stats.mvpTimes} /> : null}
            {stats?.mvpVotes != null ? <Stat label="MVP votes received" value={stats.mvpVotes} /> : null}
          </Panel>
          <Link className="btn" to="/me/rewards">My rewards — manage profile display</Link>
        </div>

        <div className="rail">
          <Panel>
            <span className="tag"><em>//</em> {currentUser.userType === 'external' ? 'External record' : 'Student record — the registry owns this'}</span>
            <Facts rows={[
              ['Faculty', faculty ?? `Faculty #${currentUser.facultyId}`],
              ['Major', department ?? `Department #${currentUser.departmentId}`],
              ['Year', String(currentUser.year)],
              ['Age', String(ageOf(currentUser.birthDate))],
              ['Gender', currentUser.gender],
              ['Role', currentUser.userType === 'staff' ? 'Admin' : currentUser.userType === 'external' ? 'External' : 'User'],
            ]} />
            <span className="sub">The Hard filter reads these values. Ask the registry if one is wrong.</span>
          </Panel>
          <Panel quiet>
            <span className="tag"><em>//</em> Following</span>
            {followsQuery.isPending ? <p>Loading followed players...</p> : null}
            {followsQuery.error ? <p role="alert">Unable to load followed players. <button className="btn" onClick={() => void followsQuery.refetch()}>Retry</button></p> : null}
            {followsQuery.data?.items?.map(row => <div key={row.id}><Link to={`/player/${row.id}`}>{row.fullName}</Link></div>)}
            {followsQuery.isSuccess && !followsQuery.data.items?.length ? <p>No followed players yet.</p> : null}
          </Panel>
        </div>
      </div>
    </>
  )
}

function ProfileHeading({ label, user, isExternal }: { label: string; user: MeDto; isExternal?: boolean }) {
  const updateMe = useUpdateMe()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const inputId = 'profile-avatar-upload'
  const isExternalUser = isExternal ?? (user.userType === 'external')

  const pick = async (file: File | undefined) => {
    if (!file || loading || updateMe.isPending) return
    setErr(null)
    setLoading(true)
    try {
      if (USE_MOCK) {
        const dataUrl = await shrinkImage(file)
        await updateMe.mutateAsync({ avatarUrl: dataUrl })
      } else {
        const objectKey = await uploadImage(file, 'avatar')
        await updateMe.mutateAsync({ avatarUrl: objectKey })
      }
    } catch (e) {
      setErr(imageUploadErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const removeAvatar = async () => {
    setErr(null)
    setLoading(true)
    try {
      await updateMe.mutateAsync({ avatarUrl: null })
    } catch (e) {
      setErr(imageUploadErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="spread" style={{ alignItems: 'flex-start' }}>
      <div className="hstack" style={{ gap: 18, alignItems: 'center' }}>
        <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size={72} alt={user.fullName}
          style={{ borderRadius: '50%', border: '2px solid var(--line)' }} />
        <div>
          <div className="tag"><em>//</em> {label}</div>
          <h1 className="disp" style={{ fontSize: 32, margin: '2px 0 6px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {user.fullName}
            {isExternalUser ? USE_MOCK ? <Badge kind="neutral">External</Badge> : <ExternalIdentityBadge /> : null}
          </h1>
          <div className="hstack" style={{ gap: 8 }}>
            <input id={inputId} type="file" accept={USE_MOCK ? IMAGE_ACCEPT : UPLOAD_IMAGE_ACCEPT} disabled={loading || updateMe.isPending} aria-label="Choose profile photo" style={{ display: 'none' }}
              onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
            <button className="btn ghost" type="button" disabled={loading || updateMe.isPending}
              onClick={() => document.getElementById(inputId)?.click()} style={{ padding: '2px 8px', fontSize: 13 }}>
              <Icon name="plus" size={12} /> {loading ? 'Uploading…' : user.avatarUrl ? 'Change photo' : 'Upload photo'}
            </button>
            {user.avatarUrl ? (
              <button className="btn ghost" type="button" style={{ padding: '2px 8px', fontSize: 13 }}
                disabled={loading || updateMe.isPending} onClick={removeAvatar}>
                Remove Photo
              </button>
            ) : null}
          </div>
          {err || updateMe.isError ? (
            <span role="alert" className="sub" style={{ color: 'var(--red)', display: 'block', marginTop: 4 }}>
              {err ?? imageUploadErrorMessage(updateMe.error)}
            </span>
          ) : null}
        </div>
      </div>
      <Badge kind="neutral">{user.email}</Badge>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div><span className="tag">{label}</span><span className="v">{value}</span></div>
}
