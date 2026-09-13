/**
 * src/features/team/TeamRecord.tsx
 *
 * A squad's record — results by sport, honours, recent results, and the
 * tournaments it entered.
 *
 * ── โหมด mock เท่านั้น ─────────────────────────────────────────────────────
 * backend ยังไม่มี route ผลแข่งหรือสถิติของทีม (FEAT-1-REMAINING: match list,
 * result และ standings อยู่ในหมวด backend blockers) ส่วนนี้จึงอ่านจาก store และ
 * หน้าทีมแสดงเฉพาะเมื่อหาทีมใน store เจอ · เดิมอยู่ใน TeamPage และหายไปตอนย้าย
 * หน้าทีมไปอ่านจาก GET /teams/:id
 */
import { useNavigate } from 'react-router-dom'
import { Badge, FormGuide, Panel, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { TeamLink } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { tour } from '../../shared/selectors'
import { fmtDate, leaderboard, statLabels } from '../../shared/rules'
import { teamBySport } from '../../shared/career'
import type { Team } from '../../shared/types'

const ordinal = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

export function TeamRecord({ t }: { t: Team }) {
  const s = useLtms()
  const navigate = useNavigate()

  const played = s.matches
    .filter(m => (m.a === t.id || m.b === t.id) && m.status === 'confirmed' && m.note !== 'bye')
    .sort((x, y) => new Date(y.kickoff).getTime() - new Date(x.kickoff).getTime())

  const rec = played.reduce((acc, m) => {
    const mine = m.a === t.id ? m.sa ?? 0 : m.sb ?? 0
    const theirs = m.a === t.id ? m.sb ?? 0 : m.sa ?? 0
    const won = mine > theirs
    return { p: acc.p + 1, w: acc.w + (won ? 1 : 0), form: [...acc.form, won ? 'W' : 'L'] }
  }, { p: 0, w: 0, form: [] as string[] })

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
      <div className="statline">
        <div><span className="tag">Played · all sports</span><span className="v">{rec.p}</span></div>
        <div><span className="tag">Won</span><span className="v">{rec.w}</span></div>
        <div><span className="tag">Sports</span><span className="v">{sports.length}</span></div>
        <div><span className="tag">Best finish</span><span className="v">{best ? ordinal(best) : '—'}</span></div>
      </div>
      {rec.form.length ? <div className="hstack"><span className="tag">Form</span><FormGuide form={rec.form} /></div> : null}

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
