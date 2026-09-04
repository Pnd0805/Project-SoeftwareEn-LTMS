/**
 * src/features/watch/WatchPage.tsx
 *
 * The guest-facing live view. There is no video to stream locally, so what is
 * "live" here is the state itself — the scoreline, and the commentary the system
 * can actually derive from what referees recorded. Stream *ingest* is out of
 * scope; these screens assume a stream URL exists.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Crumb, Empty, Panel, StatusBadge, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Scorebug } from '../../components/kit/Scorebug'
import { PlayerLink, TeamLink } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { matchesOf, user } from '../../shared/selectors'
import { routeTour } from '../../mocks/routeIds'
import { matchStage, matchTag } from '../../shared/rules'

export function WatchPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id } = useParams()
  const t = routeTour(s, id)

  if (!t) return <Empty icon="warn" title="No such tournament" />

  const ms = matchesOf(s, t.id).filter(m => m.a && m.b)
  const live = ms.filter(m => m.status === 'scheduled' || m.status === 'pending')
  const done = ms.filter(m => m.status === 'confirmed' && m.note !== 'bye')
  const feature = live[0] ?? done[done.length - 1]

  if (!feature) {
    return <Empty icon="match" title="Nothing to watch yet" sub="Matches appear here once the bracket is drawn." />
  }
  const isLive = feature.status !== 'confirmed'

  return (
    <>
      <Crumb back={{ label: t.name, onClick: () => navigate(`/t/${t.id}`) }}>Watch</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 28 }}>{matchStage(s, feature)}</h1>
        {isLive ? <span className="live"><i />Live</span> : <Badge kind="ok">Full time</Badge>}
      </div>

      <Scorebug m={feature} />

      <Panel quiet style={{ alignItems: 'center', padding: '34px 20px', textAlign: 'center' }}>
        <Icon name="match" size={34} />
        <div className="disp" style={{ fontSize: 21 }}>
          {isLive ? `Stream from ${feature.venue || 'the venue'}` : `Replay — ${feature.venue || 'the venue'}`}
        </div>
        <span className="sub">Stream ingest is not part of this build — the page assumes a URL exists.</span>
      </Panel>

      <div className="grid2">
        <Panel quiet>
          <span className="tag"><em>//</em> What the system knows</span>
          {feature.enteredBy ? (
            <div className="hstack">
              <Badge kind="ok">Recorded</Badge>
              <span className="sub">{user(s, feature.enteredBy)?.name} entered {feature.sa}–{feature.sb}</span>
            </div>
          ) : null}
          {Object.entries(feature.stats || {}).map(([pid, st]) => (
            <div className="hstack" key={pid}>
              <span className="tag num" style={{ width: 46 }}>
                {st.goals ? `${st.goals}G` : ''}{st.assists ? ` ${st.assists}A` : ''}
              </span>
              <PlayerLink id={pid} />
              <TeamLink id={st.team} />
            </div>
          ))}
          <div className="hstack">
            <Badge kind={feature.status === 'confirmed' ? 'ok' : 'warn'}>{feature.status}</Badge>
            <span className="sub">{feature.checkedIn.length} player{feature.checkedIn.length === 1 ? '' : 's'} checked in</span>
          </div>
        </Panel>

        <Panel quiet>
          <span className="tag"><em>//</em> Elsewhere in this tournament</span>
          {ms.filter(m => m.id !== feature.id).slice(0, 6).map(m => (
            <div className="hstack" style={{ justifyContent: 'space-between' }} key={m.id}>
              <span className="hstack"><TeamLink id={m.a} /><span className="tag">vs</span><TeamLink id={m.b} /></span>
              <span className="hstack"><span className="num">{m.sa ?? '—'} – {m.sb ?? '—'}</span><StatusBadge m={m} /></span>
            </div>
          ))}
        </Panel>
      </div>

      {done.length ? (
        <>
          <span className="tag"><em>//</em> Replays · {done.length}</span>
          <TableWrap>
            <table>
              <thead><tr><th>Round</th><th>Home</th><th /><th>Away</th><th>Score</th><th>Replay</th><th /></tr></thead>
              <tbody>
                {done.map(m => (
                  <tr key={m.id}>
                    <td className="tag">{matchTag(s, m)}</td>
                    <td><TeamLink id={m.a} /></td>
                    <td className="tag">vs</td>
                    <td><TeamLink id={m.b} /></td>
                    <td className="num">{m.sa} – {m.sb}</td>
                    <td>{m.replay ? <a href={m.replay} target="_blank" rel="noopener">Replay</a> : <span className="sub">—</span>}</td>
                    <td><button className="btn ghost" type="button" onClick={() => navigate(`/m/${m.id}`)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : null}
    </>
  )
}
