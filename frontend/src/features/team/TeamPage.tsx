/**
 * src/features/team/TeamPage.tsx
 *
 * The public squad profile. Open to guests: a spectator who just watched a match
 * wants the club behind it, and should not have to sign in for that.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Crumb, Empty, FormGuide, Panel, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { TeamLink } from '../../components/kit/chips'
import { toggleFollow, useLtms } from '../../shared/store'
import { isFollowing, me, team, tour, user } from '../../shared/selectors'
import { ageOf, fmtDate, leaderboard, minSquad, statLabels, teamReady } from '../../shared/rules'
import { teamBySport } from '../../shared/career'

const ordinal = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

export function TeamPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id } = useParams()
  const t = team(s, id)

  if (!t) {
    return (
      <Empty icon="team" title="No such squad">
        <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
      </Empty>
    )
  }

  const played = s.matches
    .filter(m => (m.a === t.id || m.b === t.id) && m.status === 'confirmed' && m.note !== 'bye')
    .sort((x, y) => new Date(y.kickoff).getTime() - new Date(x.kickoff).getTime())

  const rec = played.reduce((acc, m) => {
    const mine = m.a === t.id ? m.sa ?? 0 : m.sb ?? 0
    const theirs = m.a === t.id ? m.sb ?? 0 : m.sa ?? 0
    const won = mine > theirs
    return { p: acc.p + 1, w: acc.w + (won ? 1 : 0), gf: acc.gf + mine, ga: acc.ga + theirs, form: [...acc.form, won ? 'W' : 'L'] }
  }, { p: 0, w: 0, gf: 0, ga: 0, form: [] as string[] })

  const entered = s.registrations.filter(r => r.team === t.id)
  const titles = s.tournaments.filter(x => x.champion === t.id)
  const finishes = entered.map(r => {
    const tr = tour(s, r.tour)
    if (!tr || !tr.drawn) return null
    const row = leaderboard(s, tr).find(x => x.team === t.id)
    return row ? { tr, row } : null
  }).filter(Boolean) as { tr: NonNullable<ReturnType<typeof tour>>; row: { rank: number; outLabel: string } }[]
  const best = finishes.length ? Math.min(...finishes.map(f => f.row.rank)) : null
  const sports = teamBySport(s, t.id)

  return (
    <>
      <Crumb back={{ label: 'Tournaments', onClick: () => navigate('/') }}>{t.name}</Crumb>

      <div className="spread">
        <span className="hstack" style={{ gap: 16 }}>
          <span style={{
            width: 64, height: 64, flex: 'none', display: 'grid', placeItems: 'center', background: t.color,
            color: 'var(--void)', fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 24,
            clipPath: 'polygon(0 0,100% 0,100% 74%,74% 100%,0 100%)',
          }}>{t.code}</span>
          <span className="vstack" style={{ gap: 5 }}>
            <span className="disp" style={{ fontSize: 32 }}>{t.name}</span>
            <span className="hstack">
              {t.permanent ? <Badge kind="ok">Permanent club</Badge>
                : t.disabled ? <Badge kind="crit">Disabled</Badge>
                  : teamReady(t) ? <Badge kind="ok">Ready</Badge>
                    : <Badge kind="warn">{`Forming · ${t.members.length} of ${minSquad(t)}`}</Badge>}
              <span className="tag">Captain <em>{user(s, t.leader)?.name ?? '—'}</em></span>
              {rec.form.length ? <FormGuide form={rec.form} /> : null}
            </span>
          </span>
        </span>
        {me(s) ? (
          <button className={`btn ${isFollowing(s, `team:${t.id}`) ? 'ghost' : 'primary'}`} type="button"
            onClick={() => toggleFollow(`team:${t.id}`)}>
            {isFollowing(s, `team:${t.id}`) ? 'Following' : 'Follow this squad'}
          </button>
        ) : null}
      </div>

      <div className="statline">
        <div><span className="tag">Played · all sports</span><span className="v">{rec.p}</span></div>
        <div><span className="tag">Won</span><span className="v">{rec.w}</span></div>
        <div><span className="tag">Sports</span><span className="v">{sports.length}</span></div>
        <div><span className="tag">Best finish</span><span className="v">{best ? ordinal(best) : '—'}</span></div>
      </div>

      {sports.length ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Record by sport — a club can field sides in several</span>
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
                  <div><span className="tag">Win rate</span><span className="v">{Math.round((r.w / r.p) * 100)}%</span></div>
                  {L.g ? <div><span className="tag">{L.g} for</span><span className="v">{r.gf}</span></div> : null}
                  {L.g ? <div><span className="tag">{L.g} against</span><span className="v">{r.ga}</span></div> : null}
                </div>
              </div>
            )
          })}
        </Panel>
      ) : null}

      {titles.length ? (
        <Panel>
          <span className="tag"><em>//</em> Honours</span>
          <div className="hstack">
            {titles.map(x => (
              <span className="hstack" style={{ gap: 9, padding: '11px 14px', background: 'var(--panel-2)' }} key={x.id}>
                <Icon name="trophy" size={18} />
                <span><b style={{ fontSize: 15 }}>{x.name}</b><br /><span className="tag">Champions</span></span>
              </span>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel quiet>
        <div className="spread"><span className="tag"><em>//</em> Squad · {t.members.length}</span></div>
        <TableWrap>
          <table>
            <thead><tr><th>Player</th><th>Faculty</th><th>Year</th><th>Age</th><th /></tr></thead>
            <tbody>
              {t.members.map(pid => {
                const p = user(s, pid)
                if (!p) return null
                return (
                  <tr key={pid}>
                    <td>
                      <span className="hstack">
                        <span className="avatar">{p.name.slice(0, 1)}</span>{p.name}
                        {t.leader === pid ? <span className="tag"> · captain</span> : null}
                      </span>
                    </td>
                    <td className="sub">{p.faculty}</td>
                    <td className="num">{p.year}</td>
                    <td className="num">{ageOf(p.dob)}</td>
                    <td>
                      <button className="btn ghost" type="button" onClick={() => navigate(`/player/${pid}`)}>
                        Profile <Icon name="chev" size={11} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      </Panel>

      <Panel quiet>
        <span className="tag"><em>//</em> Results · {played.length}</span>
        {played.length ? (
          <TableWrap>
            <table>
              <thead>
                <tr><th>Date</th><th>Sport</th><th>Tournament</th><th>Home</th><th /><th>Away</th><th>Score</th><th /><th /></tr>
              </thead>
              <tbody>
                {played.slice(0, 12).map(m => {
                  const mine = m.a === t.id ? m.sa ?? 0 : m.sb ?? 0
                  const theirs = m.a === t.id ? m.sb ?? 0 : m.sa ?? 0
                  const won = mine > theirs
                  return (
                    <tr key={m.id}>
                      <td className="num">{fmtDate(m.kickoff)}</td>
                      <td><span className="badge neutral">{tour(s, m.tour)?.sport ?? '—'}</span></td>
                      <td className="sub">{tour(s, m.tour)?.name ?? '—'}</td>
                      <td><TeamLink id={m.a} /></td>
                      <td className="tag">vs</td>
                      <td><TeamLink id={m.b} /></td>
                      <td className="num">{m.sa} – {m.sb}</td>
                      <td>{won ? <Badge kind="ok">W</Badge> : <Badge kind="crit">L</Badge>}</td>
                      <td><button className="btn ghost" type="button" onClick={() => navigate(`/m/${m.id}`)}>Open</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : <div className="sub">Nothing played yet.</div>}
      </Panel>

      {entered.length ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Tournaments entered</span>
          <TableWrap>
            <table>
              <thead><tr><th>Tournament</th><th>Sport</th><th>Status</th><th>Finish</th><th /></tr></thead>
              <tbody>
                {entered.map(r => {
                  const tr = tour(s, r.tour)
                  if (!tr) return null
                  const f = finishes.find(x => x.tr.id === tr.id)
                  return (
                    <tr key={r.id}>
                      <td>{tr.name}</td>
                      <td><span className="badge neutral">{tr.sport}</span></td>
                      <td>
                        {r.status === 'approved' ? <Badge kind="ok">Entered</Badge>
                          : r.status === 'pending' ? <Badge kind="warn">Awaiting review</Badge>
                            : <Badge kind="crit">{r.status}</Badge>}
                      </td>
                      <td className="sub">{f ? f.row.outLabel : '—'}</td>
                      <td>
                        {tr.status === 'public'
                          ? <button className="btn ghost" type="button" onClick={() => navigate(`/t/${tr.id}`)}>Open</button>
                          : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}
    </>
  )
}
