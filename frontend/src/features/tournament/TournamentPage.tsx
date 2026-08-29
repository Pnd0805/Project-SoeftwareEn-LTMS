/**
 * src/features/tournament/TournamentPage.tsx
 *
 * The heavy page splits in half: tabs and their content left, a sticky rail of
 * facts right. Below 900px the rail drops under the content. The rail carries
 * the .facts card (sport, format, date, venue, channel, entry rules, squads in,
 * organizer), the entry panel, and the organizer's entry notes.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Crumb, Empty, Facts, Panel, Tabs, VenueLine } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { useLtms } from '../../shared/store'
import { isOrg, matchesOf, regsOf, team, tour, user, visibleTo } from '../../shared/selectors'
import { formatName, ruleSummary } from '../../shared/rules'
import { BracketTab } from './BracketTab'
import { ScheduleTab } from './ScheduleTab'
import { LeaderboardTab } from './LeaderboardTab'
import { AnnouncementsTab } from './AnnouncementsTab'
import { CommunityTab } from './CommunityTab'
import { EntryPanel } from './EntryPanel'
import { ManageTab } from './manage/ManageTab'

const PUBLIC_TABS = ['bracket', 'schedule', 'leaderboard', 'announcements', 'community']

export function TournamentPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id, tab: tabParam, sub } = useParams()
  const t = tour(s, id)

  if (!t) {
    return (
      <Empty icon="warn" title="That tournament doesn't exist">
        <button className="btn" type="button" onClick={() => navigate('/')}>Go back</button>
      </Empty>
    )
  }

  /* the list and the search already filter these out; this stops a guessed URL too */
  if (!visibleTo(s, t)) {
    return (
      <Empty icon="warn" title="Not published yet"
        sub={t.status === 'pending'
          ? 'This tournament is still waiting on admin approval.'
          : 'This tournament is private until its organizer publishes it.'}>
        <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
      </Empty>
    )
  }

  const org = isOrg(s, t)

  /**
   * Organizer is scoped per tournament and several people hold it at once.
   * Asking for somebody else's manage tab is refused out loud — quietly swapping
   * in the bracket reads as a bug, and hides that ownership is what is in the way.
   */
  if (tabParam === 'manage' && !org) {
    const who = user(s, t.organizer)
    return (
      <>
        <Crumb back={{ label: t.name, onClick: () => navigate(`/t/${t.id}`) }} />
        <Empty icon="warn" title="403 — not yours to manage"
          sub={<>
            {t.name} is run by <b style={{ color: 'var(--bone)' }}>{who?.name ?? 'another organizer'}</b>.
            {' '}Organizer is granted per tournament, so it does not carry across to this one.
          </>}>
          <span className="hstack">
            <button className="btn" type="button" onClick={() => navigate(`/t/${t.id}/bracket`)}>Open the public page</button>
            <button className="btn ghost" type="button" onClick={() => navigate('/')}>Your tournaments</button>
          </span>
        </Empty>
      </>
    )
  }

  const tabs = [...PUBLIC_TABS, ...(org ? ['manage'] : [])]
  const tab = tabs.includes(tabParam ?? '') ? tabParam! : 'bracket'
  const approved = regsOf(s, t.id).filter(r => r.status === 'approved')
  const champion = t.champion ? team(s, t.champion) : null
  const watchable = matchesOf(s, t.id).some(m => m.status === 'scheduled' && m.a && m.b)

  return (
    <>
      <Crumb back={{ label: 'Tournaments', onClick: () => navigate('/') }}>{t.name}</Crumb>

      <div className="spread">
        <div>
          <div className="tag"><em>//</em> {t.sport} · {formatName(t)} · {t.channel}</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>{t.name}</h1>
          <div className="tag" style={{ marginTop: 6 }}>
            {org ? <><em>//</em> You run this tournament</> : `Run by ${user(s, t.organizer)?.name ?? '—'}`}
          </div>
        </div>
        <div className="hstack">
          {champion ? <Badge kind="ok">{`Champion · ${champion.name}`}</Badge>
            : t.status === 'public' ? <Badge kind="ok">Public</Badge>
              : t.status === 'private' ? <Badge kind="neutral">Private</Badge>
                : <Badge kind="warn">Pending review</Badge>}
          {champion ? (
            <button className="btn primary" type="button" onClick={() => navigate(`/mvp/${t.id}`)}>
              <Icon name="star" size={12} /> Vote MVP
            </button>
          ) : null}
          {watchable ? (
            <button className="btn" type="button" onClick={() => navigate(`/watch/${t.id}`)}>
              <Icon name="match" size={12} /> Watch
            </button>
          ) : null}
        </div>
      </div>

      <div className="split">
        <div>
          <Tabs
            tabs={tabs.map(x => ({ key: x, label: x === 'manage' ? 'Manage' : x }))}
            active={tab}
            onPick={k => navigate(`/t/${t.id}/${k}`)}
          />
          {tab === 'bracket' ? <BracketTab t={t} /> : null}
          {tab === 'schedule' ? <ScheduleTab t={t} /> : null}
          {tab === 'leaderboard' ? <LeaderboardTab t={t} /> : null}
          {tab === 'announcements' ? <AnnouncementsTab t={t} org={org} /> : null}
          {tab === 'community' ? <CommunityTab t={t} org={org} /> : null}
          {tab === 'manage' ? <ManageTab t={t} sub={sub} /> : null}
        </div>

        <div className="rail">
          <Panel>
            <span className="tag"><em>//</em> The details</span>
            <Facts rows={[
              ['Sport', t.sport],
              ['Format', formatName(t)],
              ['Date', t.date],
              ['Venue', <VenueLine name={t.venue} pin={t.pin} />],
              ['Played', t.channel],
              ['Entry', ruleSummary(t.rules) || 'open to everybody'],
              ['Squads in', <><b className="num">{approved.length}</b> <span className="sub">of {t.cap}</span></>],
              ['Run by', user(s, t.organizer)?.name ?? '—'],
            ]} />
          </Panel>
          <EntryPanel t={t} />
          {t.entryNotes ? (
            <Panel quiet>
              <span className="tag"><em>//</em> Soft filter from the organizer</span>
              <div style={{ fontSize: 15, lineHeight: 1.55 }}>{t.entryNotes}</div>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  )
}
