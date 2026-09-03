/**
 * src/features/profile/ProfilePage.tsx
 *
 * Your own record. The student details are read-only — the registry owns them,
 * and the Hard filter reads them, so a page that let you edit your own faculty
 * would be a page that let you edit your own eligibility.
 */
import { Badge, Facts, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamLink } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { tour } from '../../shared/selectors'
import { ageOf } from '../../shared/rules'
import { careerByTournament, pickScore } from '../../shared/career'
import { CareerPanel } from '../player/PlayerPage'
import { useMe } from '../../hooks/useAuth'
import { useFollows, useUserStats } from '../../hooks/useUser'

export function ProfilePage() {
  const s = useLtms()
  const { data: currentUser, isLoading, isError } = useMe()
  const {
    data: userStats,
    isLoading: statsLoading,
    isError: statsError,
  } = useUserStats(currentUser?.id)
  const { data: followsData } = useFollows(currentUser?.id)

  if (isLoading || statsLoading || isError || statsError || !currentUser || !userStats) {
    return null
  }

  // Legacy profile sections still use string IDs until their APIs are migrated.
  const legacyUser = s.users.find(user => user.email === currentUser.email)
  if (!legacyUser) return null

  const byTour = careerByTournament(s, legacyUser.id)
  const played = userStats.overall.matchesPlayed
  const won = userStats.overall.wins
  const titles = userStats.overall.championCount
  const p = pickScore(s, legacyUser.id)
  const squads = s.teams.filter(t => t.members.includes(legacyUser.id))
  const mvpVotes = s.votes.filter(v => v.player === legacyUser.id).length
  const follows = followsData?.targets ?? []

  return (
    <>
      <div className="spread">
        <div>
          <div className="tag"><em>//</em> {legacyUser.role === 'Admin' ? 'Administrator' : 'Student record'}</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>{currentUser.fullName}</h1>
        </div>
        <Badge kind="neutral">{currentUser.email}</Badge>
      </div>

      <div className="statline">
        <div><span className="tag">Matches played</span><span className="v">{played}</span></div>
        <div><span className="tag">Won</span><span className="v">{won}</span></div>
        <div><span className="tag">Titles</span><span className="v">{titles}</span></div>
        <div><span className="tag">Tokens</span><span className="v">{p.tokens}</span></div>
      </div>

      <div className="split">
        <div>
          <CareerPanel pid={legacyUser.id} />

          <Panel quiet>
            <span className="tag"><em>//</em> Pick'em</span>
            <div className="statline">
              <div><span className="tag">Calls made</span><span className="v">{p.total}</span></div>
              <div><span className="tag">Correct</span><span className="v">{p.right}</span></div>
              <div><span className="tag">Held</span><span className="v">{p.held}</span></div>
            </div>
            <span className="sub">
              A pick on a match that is not Confirmed is held, not scored. Anyone officiating a tournament
              cannot predict in it at all.
            </span>
          </Panel>

          <Panel quiet>
            <span className="tag"><em>//</em> Squads · {squads.length}</span>
            {squads.length ? (
              <TableWrap>
                <table>
                  <thead><tr><th>Squad</th><th>Role</th><th>Sport</th></tr></thead>
                  <tbody>
                    {squads.map(t => (
                      <tr key={t.id}>
                        <td><TeamLink id={t.id} /></td>
                        <td className="sub">{t.leader === legacyUser.id ? 'Leader' : 'Player'}</td>
                        <td className="sub">{t.sport ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : <div className="sub">Not in a squad yet.</div>}
          </Panel>

          {byTour.length ? (
            <Panel quiet>
              <span className="tag"><em>//</em> Tournaments</span>
              <TableWrap>
                <table>
                  <thead><tr><th>Tournament</th><th>Sport</th><th>Played</th><th>Finish</th></tr></thead>
                  <tbody>
                    {byTour.map(r => (
                      <tr key={r.tour}>
                        <td>{tour(s, r.tour)?.name ?? r.name}</td>
                        <td><span className="badge neutral">{r.sport}</span></td>
                        <td className="num">{r.p}</td>
                        <td className="sub">{r.finish}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          ) : null}
        </div>

        <div className="rail">
          <Panel>
            <span className="tag"><em>//</em> Student record — the registry owns this</span>
            <Facts rows={[
              ['Faculty', legacyUser.faculty],
              ['Major', legacyUser.major],
              ['Year', String(currentUser.year)],
              ['Age', String(ageOf(currentUser.birthDate))],
              ['Gender', currentUser.gender],
              ['Role', currentUser.userType === 'staff' ? 'Admin' : 'User'],
            ]} />
            <span className="sub">
              The Hard filter reads these. They cannot be edited here — ask the registry if one is wrong.
            </span>
          </Panel>

          <Panel quiet>
            <span className="tag"><em>//</em> Following · {follows.length}</span>
            {follows.length
              ? follows.map(k => <div className="sub" key={k}>{k.replace('team:', 'Squad · ').replace('player:', 'Player · ')}</div>)
              : <span className="sub">Follow a squad or a player and their results land in your inbox.</span>}
          </Panel>

          <Panel quiet>
            <span className="tag"><em>//</em> MVP votes received</span>
            <span className="v" style={{ fontFamily: 'var(--f-display)', fontSize: 30, color: 'var(--teal)' }}>{mvpVotes}</span>
          </Panel>
        </div>
      </div>
    </>
  )
}
