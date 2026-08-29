/**
 * src/features/admin/AdminPage.tsx
 *
 * The Admin approves or rejects requests and manages the system globally; they
 * do not manage individual tournaments. Three queues, all asked-and-decided:
 * requests to organize, permanent-squad exemptions, and hard-filter changes.
 */
import { Badge, Empty, Panel, TableWrap, Tabs } from '../../components/kit/primitives'
import { useNavigate, useParams } from 'react-router-dom'
import { TeamLink } from '../../components/kit/chips'
import { decideFilterChange, decidePermanent, decideTournament, useLtms } from '../../shared/store'
import { isAdmin, regsOf, user } from '../../shared/selectors'
import { fmtDate, formatName, ruleSummary } from '../../shared/rules'

const TABS = [
  { key: 'requests', label: 'Requests to organize' },
  { key: 'permanent', label: 'Permanent squads' },
  { key: 'filters', label: 'Hard-filter changes' },
  { key: 'tournaments', label: 'All tournaments' },
  { key: 'users', label: 'Users' },
]

export function AdminPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const tab = TABS.some(t => t.key === tabParam) ? tabParam! : 'requests'

  if (!isAdmin(s)) {
    return (
      <Empty icon="shield" title="403 — admin only"
        sub="Admin approves requests and manages the system. It is not a per-tournament right.">
        <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
      </Empty>
    )
  }

  const requests = s.tournaments.filter(t => t.status === 'pending')
  const permanent = s.permanentRequests.filter(r => r.status === 'pending')
  const filters = s.tournaments.filter(t => t.filterChangeRequest)

  return (
    <>
      <div className="spread">
        <div>
          <div className="tag"><em>//</em> System administration</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>Admin</h1>
        </div>
        <div className="hstack">
          {requests.length ? <Badge kind="crit">{`${requests.length} to organize`}</Badge> : null}
          {permanent.length ? <Badge kind="warn">{`${permanent.length} permanent`}</Badge> : null}
          {filters.length ? <Badge kind="warn">{`${filters.length} filter change${filters.length === 1 ? '' : 's'}`}</Badge> : null}
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onPick={k => navigate(`/admin/${k}`)} />

      {tab === 'requests' ? (
        <Panel>
          <span className="tag"><em>//</em> Requests to organize · {requests.length}</span>
          {requests.length ? requests.map(t => (
            <div className="vstack" style={{ gap: 9 }} key={t.id}>
              <div className="spread">
                <span className="hstack">
                  <b>{t.name}</b>
                  <Badge kind="neutral">{t.sport}</Badge>
                  <Badge kind="neutral">{formatName(t)}</Badge>
                  <Badge kind="neutral">{t.channel}</Badge>
                </span>
                <span className="tag">{fmtDate(t.date)}</span>
              </div>
              <div className="sub">
                {user(s, t.organizer)?.name} · {t.venue} · cap {t.cap} · entry {ruleSummary(t.rules) || 'open to everybody'}
              </div>
              <div className="sub">
                Approving grants Organizer over this tournament only, and it lands in their drafts as Private —
                they still have to appoint referees before it can go public.
              </div>
              <div className="hstack">
                <button className="btn danger" type="button" onClick={() => decideTournament(t.id, false)}>Decline</button>
                <button className="btn primary" type="button" onClick={() => decideTournament(t.id, true)}>Approve</button>
              </div>
            </div>
          )) : <div className="sub">Nothing waiting.</div>}
        </Panel>
      ) : null}

      {tab === 'permanent' ? (
        <Panel>
          <span className="tag"><em>//</em> Permanent-squad requests · {permanent.length}</span>
          <div className="sub">
            For standing clubs, not for squads avoiding the deadline — exemption stays a judgement rather
            than a checkbox a squad ticks.
          </div>
          {permanent.length ? (
            <TableWrap>
              <table>
                <thead><tr><th>Squad</th><th>Asked by</th><th>Reason</th><th>When</th><th /></tr></thead>
                <tbody>
                  {permanent.map(r => (
                    <tr key={r.id}>
                      <td><TeamLink id={r.team} /></td>
                      <td className="sub">{user(s, r.by)?.name ?? '—'}</td>
                      <td className="sub">{r.reason}</td>
                      <td className="tag">{fmtDate(r.at)}</td>
                      <td>
                        <span className="hstack" style={{ gap: 6 }}>
                          <button className="btn ghost" type="button" onClick={() => decidePermanent(r.id, false)}>Decline</button>
                          <button className="btn primary" type="button" onClick={() => decidePermanent(r.id, true)}>Approve</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : <div className="sub">Nothing waiting.</div>}
        </Panel>
      ) : null}

      {tab === 'filters' ? (
        <Panel>
          <span className="tag"><em>//</em> Hard-filter change requests · {filters.length}</span>
          <div className="sub">
            The conditions are set once and enforced with no override. This queue exists because the
            alternative is an organizer quietly widening the rules once they see who registered.
          </div>
          {filters.length ? filters.map(t => (
            <div className="vstack" style={{ gap: 9 }} key={t.id}>
              <div className="spread">
                <b>{t.name}</b>
                <span className="tag">{user(s, t.organizer)?.name}</span>
              </div>
              <div className="sub">Now: {ruleSummary(t.rules) || 'open to everybody'}</div>
              <div className="sub">Asked for: {ruleSummary(t.filterChangeRequest!.rules) || 'no conditions'}</div>
              <div className="sub">Why: {t.filterChangeRequest!.reason}</div>
              <div className="hstack">
                <button className="btn danger" type="button" onClick={() => decideFilterChange(t.id, false)}>Decline</button>
                <button className="btn primary" type="button" onClick={() => decideFilterChange(t.id, true)}>Approve the change</button>
              </div>
            </div>
          )) : <div className="sub">Nothing waiting.</div>}
        </Panel>
      ) : null}

      {tab === 'tournaments' ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Every tournament · {s.tournaments.length}</span>
          <TableWrap>
            <table>
              <thead><tr><th>Tournament</th><th>Sport</th><th>Format</th><th>Organizer</th><th>Status</th><th>Squads</th><th /></tr></thead>
              <tbody>
                {s.tournaments.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td><span className="badge neutral">{t.sport}</span></td>
                    <td className="sub">{formatName(t)}</td>
                    <td className="sub">{user(s, t.organizer)?.name ?? '—'}</td>
                    <td>
                      {t.champion ? <Badge kind="ok">Finished</Badge>
                        : t.status === 'public' ? <Badge kind="ok">Public</Badge>
                          : t.status === 'private' ? <Badge kind="neutral">Private</Badge>
                            : <Badge kind="warn">Pending</Badge>}
                    </td>
                    <td className="num">{regsOf(s, t.id).filter(r => r.status === 'approved').length} / {t.cap}</td>
                    <td><button className="btn ghost" type="button" onClick={() => navigate(`/t/${t.id}`)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'users' ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Users · {s.users.length}</span>
          <div className="sub">
            Officiating and organizing are scoped per tournament, so there is nothing global to grant here —
            this is the roll the organizers search.
          </div>
          <TableWrap>
            <table>
              <thead><tr><th>Name</th><th>Faculty</th><th>Year</th><th>Squads</th><th>Role</th></tr></thead>
              <tbody>
                {s.users.slice(0, 40).map(x => (
                  <tr key={x.id}>
                    <td>{x.name}</td>
                    <td className="sub">{x.faculty} · {x.major}</td>
                    <td className="num">{x.year}</td>
                    <td className="num">{s.teams.filter(t => t.members.includes(x.id)).length}</td>
                    <td>{x.role === 'Admin' ? <Badge kind="crit">Admin</Badge> : <Badge kind="neutral">User</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <span className="sub">Showing the first 40 of {s.users.length}. Search the roll from a tournament's referee finder.</span>
        </Panel>
      ) : null}
    </>
  )
}
