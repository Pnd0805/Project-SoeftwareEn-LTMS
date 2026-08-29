/**
 * src/features/tournament/ScheduleTab.tsx
 *
 * Every fixture in one table. Wide tables still scroll inside .tblwrap when the
 * rail narrows their column. The organizer gets a Fixture control on any match
 * that has not started — kick-off, venue and officials are set there.
 */
import { useNavigate } from 'react-router-dom'
import { Empty, StatusBadge, TableWrap } from '../../components/kit/primitives'
import { TeamLink } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { isOrg, matchesOf } from '../../shared/selectors'
import { fmtDate, matchTag } from '../../shared/rules'
import type { Tournament } from '../../shared/types'

export function ScheduleTab({ t }: { t: Tournament }) {
  const s = useLtms()
  const navigate = useNavigate()
  const ms = matchesOf(s, t.id).filter(m => m.note !== 'bye')
  const org = isOrg(s, t)

  if (!ms.length) {
    return <Empty icon="clock" title="Nothing scheduled yet" sub="Fixtures appear once the bracket is drawn." />
  }

  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th>Kick-off</th><th>Round</th><th>Home</th><th /><th>Away</th><th>Score</th><th>State</th><th />
          </tr>
        </thead>
        <tbody>
          {ms.map(m => (
            <tr key={m.id}>
              <td className="num">{fmtDate(m.kickoff)}</td>
              <td className="tag">{matchTag(s, m)}</td>
              <td><TeamLink id={m.a} /></td>
              <td className="tag">vs</td>
              <td><TeamLink id={m.b} /></td>
              <td className="num">{m.sa ?? '—'} – {m.sb ?? '—'}</td>
              <td><StatusBadge m={m} /></td>
              <td>
                <span className="hstack" style={{ gap: 8 }}>
                  <button className="btn ghost" type="button" onClick={() => navigate(`/m/${m.id}`)}>Open</button>
                  {org && m.status === 'scheduled' && !m.checkedIn.length
                    ? <button className="btn ghost" type="button" onClick={() => navigate(`/m/${m.id}/fixture`)}>Fixture</button>
                    : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}
