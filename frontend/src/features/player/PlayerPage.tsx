/**
 * src/features/player/PlayerPage.tsx
 *
 * The public player profile, and the career panel behind it. Figures are grouped
 * by sport and never summed across them — six goals at football and six points
 * at basketball are not twelve of anything.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Crumb, Empty, FormGuide, Panel, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { TeamLink } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { routeUser } from '../../mocks/routeIds'
import { ageOf, statLabels, teamReady } from '../../shared/rules'
import { careerBySport, careerByTournament } from '../../shared/career'
import { useMe } from '../../hooks/useAuth'
import { useFollow } from '../../hooks/useUser'

export function CareerPanel({ pid }: { pid: string }) {
  const s = useLtms()
  const sports = careerBySport(s, pid)
  const tours = careerByTournament(s, pid)
  if (!sports.length) {
    return (
      <Panel quiet>
        <span className="tag"><em>//</em> Career</span>
        <div className="sub">Nothing recorded yet — figures appear once a referee confirms a match they played in.</div>
      </Panel>
    )
  }
  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Career by sport — never summed across them</span>
      {sports.map(r => {
        const L = statLabels(r.sport)
        return (
          <div className="sportcard" key={r.sport}>
            <div className="spread">
              <span className="hstack" style={{ gap: 10 }}>
                <Icon name="match" size={16} />
                <b className="disp" style={{ fontSize: 19 }}>{r.sport}</b>
                <span className="tag">{r.tours.size} tournament{r.tours.size === 1 ? '' : 's'}</span>
              </span>
              <FormGuide form={r.form} />
            </div>
            <div className="statline">
              <div><span className="tag">Played</span><span className="v">{r.p}</span></div>
              <div><span className="tag">Won</span><span className="v">{r.w}</span></div>
              {L.g ? <div><span className="tag">{L.g}</span><span className="v">{r.goals}</span></div> : null}
              {L.a ? <div><span className="tag">{L.a}</span><span className="v">{r.assists}</span></div> : null}
            </div>
          </div>
        )
      })}
      <span className="tag"><em>//</em> By tournament</span>
      <TableWrap>
        <table>
          <thead><tr><th>Tournament</th><th>Sport</th><th>Played</th><th>Won</th><th>Finish</th></tr></thead>
          <tbody>
            {tours.map(r => (
              <tr key={r.tour}>
                <td>{r.name}</td>
                <td><span className="badge neutral">{r.sport}</span></td>
                <td className="num">{r.p}</td>
                <td className="num">{r.w}</td>
                <td className="sub">{r.finish}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Panel>
  )
}

export function PlayerPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id } = useParams()
  const p = routeUser(s, id)
  const { data: currentUser } = useMe()
  const follow = useFollow(currentUser?.id, `player:${id ?? ''}`)

  if (!p) {
    return (
      <Empty icon="user" title="No such player">
        <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
      </Empty>
    )
  }

  const squads = s.teams.filter(t => t.members.includes(p.id))

  return (
    <>
      <Crumb back={{ label: 'Tournaments', onClick: () => navigate('/') }}>{p.name}</Crumb>

      <div className="spread">
        <span className="hstack" style={{ gap: 16 }}>
          <span style={{
            width: 60, height: 60, flex: 'none', display: 'grid', placeItems: 'center',
            background: 'var(--red-ghost)', color: 'var(--red-text)', fontFamily: 'var(--f-display)',
            fontWeight: 700, fontSize: 26, clipPath: 'polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)',
          }}>{p.name.slice(0, 1)}</span>
          <span className="vstack" style={{ gap: 5 }}>
            <span className="disp" style={{ fontSize: 30 }}>{p.name}</span>
            <span className="hstack">
              <span className="tag">{p.faculty} · {p.major}</span>
              <span className="tag">Year <em>{p.year}</em></span>
              <span className="tag">Age <em>{ageOf(p.dob)}</em></span>
            </span>
          </span>
        </span>
        {currentUser ? (
          <button
            className={`btn ${follow.isFollowing ? 'ghost' : 'primary'}`}
            type="button"
            onClick={() => follow.toggle.mutate()}
            disabled={follow.toggle.isPending}
          >
            {follow.isFollowing ? 'Following' : 'Follow this player'}
          </button>
        ) : null}
      </div>

      <CareerPanel pid={p.id} />

      <Panel quiet>
        <span className="tag"><em>//</em> Squads · {squads.length}</span>
        {squads.length ? (
          <TableWrap>
            <table>
              <thead><tr><th>Squad</th><th>Role</th><th>Standing</th><th>State</th><th /></tr></thead>
              <tbody>
                {squads.map(t => (
                  <tr key={t.id}>
                    <td><TeamLink id={t.id} /></td>
                    <td className="sub">{t.leader === p.id ? 'Captain' : 'Player'}</td>
                    <td>{t.permanent ? <Badge kind="ok">Permanent club</Badge> : <Badge kind="neutral">Temporary</Badge>}</td>
                    <td>
                      {t.disabled ? <Badge kind="crit">Disabled</Badge>
                        : teamReady(t) ? <Badge kind="ok">Ready</Badge>
                          : <Badge kind="warn">Forming</Badge>}
                    </td>
                    <td>
                      <button className="btn ghost" type="button" onClick={() => navigate(`/team/${t.id}`)}>
                        Open <Icon name="chev" size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : <div className="sub">Not in a squad yet.</div>}
      </Panel>
    </>
  )
}
