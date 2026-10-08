/**
 * src/features/tournament/TournamentPage.tsx
 *
 * Tournament identity, paired entry/details frames and a broad public workspace.
 */
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Facts, Panel, VenueLine } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { useLtms } from '../../shared/store'
import { USE_MOCK } from '../../api/client'
import { useEligibilityRules, useTournament, useTournamentTeams } from '../../hooks/useTournament'
import { useTournamentWinner } from '../../hooks/useMatch'
import { useFaculties, useSportTypes } from '../../hooks/useReference'
import { useMe } from '../../hooks/useAuth'
import { parseBackendId } from '../../api/ids'
import { isOrg, matchesOf, regsOf, team, user, visibleTo } from '../../shared/selectors'
import { routeTour } from '../../mocks/routeIds'
import { formatName, ruleSummary } from '../../shared/rules'
import { BracketTab } from './BracketTab'
import { ScheduleTab } from './ScheduleTab'
import { LeaderboardTab } from './LeaderboardTab'
import { DashboardTab } from './DashboardTab'
import { AnnouncementsTab } from './AnnouncementsTab'
import { CommunityTab } from './CommunityTab'
import { LiveCommunityTab } from './LiveCommunityTab'
import { EntryPanel } from './EntryPanel'
import { ManageTab } from './manage/ManageTab'
import { tournamentView } from './tournamentView'
import { fmtDateOnly, fmtDateTime } from '../../shared/dateFormat'

const registrationDate = (value: string | null | undefined) =>
  (value ? fmtDateTime(value, 'Unavailable') : 'Not specified')

const PUBLIC_TABS = ['bracket', 'dashboard', 'schedule', 'leaderboard', 'announcements', 'community']

export function TournamentPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id, tab: tabParam, sub } = useParams()
  const tournamentId = parseBackendId(id)
  const tournamentQuery = useTournament(tournamentId)
  const { data: tournamentData, isPending } = tournamentQuery
  const approvedTeams = useTournamentTeams(tournamentId)
  const eligibility = useEligibilityRules(tournamentId)
  const faculties = useFaculties()
  const sportTypes = useSportTypes()
  const { data: currentUser } = useMe()
  /* ชื่อแชมป์จริงอยู่คนละเส้น และขอได้เฉพาะรายการที่ปิดแล้ว */
  const winner = useTournamentWinner(tournamentId, tournamentData?.status === 'completed')
  /* โหมดจริงอ่านจาก backend เท่านั้น — ทัวร์นาเมนต์ของ prototype (id แบบ 't-fb')
     ไม่มีตัวตนใน backend พอ id ไม่ใช่ตัวเลข ทุกแท็บที่ยิง API จะได้ 400 VALIDATION_FAILED
     กลับมา หน้าจึงดูเหมือนเปิดได้แต่พังทีละแท็บ — กันตั้งแต่ตรงนี้ชัดกว่า */
  const legacyTournament = USE_MOCK ? routeTour(s, id) : null
  const t = tournamentData
    ? tournamentView(tournamentData, eligibility.data?.items ?? [], faculties.data?.items ?? [],
      sportTypes.data?.items ?? [])
    : legacyTournament
  /* ชื่อผู้จัดมากับ GET /tournaments/:id อยู่แล้ว — store ไม่มีผู้ใช้คนนี้ในโหมดจริง */
  const organizerName = tournamentData?.organizer?.fullName
  const errorStatus = typeof tournamentQuery.error === 'object' && tournamentQuery.error !== null
    && 'status' in tournamentQuery.error ? tournamentQuery.error.status : undefined

  if (!USE_MOCK && tournamentId !== undefined && tournamentQuery.isError && errorStatus !== 404
    && (!tournamentData || errorStatus === 401 || errorStatus === 403)) {
    return <Empty icon="warn" title={errorStatus === 401 ? 'Sign in to view this tournament'
      : errorStatus === 403 ? 'You do not have access to this tournament' : 'Could not load the tournament'}>
      <button className="btn" type="button" onClick={() => void tournamentQuery.refetch()}>Retry tournament</button>
      <button className="btn ghost" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
    </Empty>
  }

  /* query ที่ถูก disable (id ไม่ใช่ตัวเลข) ก็รายงาน isPending เหมือนกัน — ถ้าไม่กัน
     ลิงก์ของ prototype จะค้างที่ "Loading tournament" ตลอดกาลแทนที่จะบอกว่าไม่มี */
  if (tournamentId !== undefined && isPending && !tournamentData && !legacyTournament) {
    return <Empty title="Loading tournament" />
  }

  if (!t || (!USE_MOCK && (tournamentId === undefined || (tournamentQuery.isError && errorStatus === 404)))) {
    return (
      <Empty icon="warn" title="Tournament unavailable" sub="This link is unavailable or the tournament is not visible to you.">
        <button className="btn" type="button" onClick={() => navigate('/')}>Go back</button>
      </Empty>
    )
  }

  /**
   * the list and the search already filter these out; this stops a guessed URL too
   *
   * ⚠️ โหมด mock เท่านั้น — `visibleTo` อ่าน session จาก store ซึ่งโหมดจริงไม่มี
   *    (`me(s)` เป็น null เสมอ) รายการที่ยังไม่ public จึงตกเงื่อนไขทั้งหมด
   *    เจ้าของเปิดรายการของตัวเองที่เพิ่งผ่าน admin แล้วเจอ "Not published yet"
   *    ทั้งที่เป็นคนสร้างเอง
   *
   *    โหมดจริงไม่ต้องเดา — `getVisibleTournament` ของ backend ตัดสินให้แล้ว
   *    ใครไม่มีสิทธิ์ได้ 404 (ซึ่งหน้านี้จับเป็น "ไม่มีรายการนี้" ไปก่อนถึงตรงนี้)
   *    ได้ข้อมูลกลับมา = ดูได้ จะเอากติกาของ store มาทับคำตอบของ server ไม่ได้
   */
  if (USE_MOCK && !visibleTo(s, t)) {
    return (
      <Empty icon="warn" title="Not published yet"
        sub={t.status === 'pending'
          ? 'This tournament is still waiting on admin approval.'
          : 'This tournament is private until its organizer publishes it.'}>
        <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
      </Empty>
    )
  }

  /**
   * "ฉันเป็นผู้จัดของรายการนี้ไหม" — โหมด mock เทียบกับ session ของ store
   * โหมดจริงเทียบ id ของผู้จัดที่มากับ GET /tournaments/:id กับ /me
   * เดิมเช็คแต่ store ผู้จัดตัวจริงจึงไม่เห็นแท็บ Manage เลย ใบสมัครที่รออนุมัติก็ไม่มีที่ให้กด
   */
  const org = USE_MOCK
    ? isOrg(s, t)
    : !!currentUser && tournamentData?.organizer?.id === currentUser.id
  const completed = tournamentData?.status === 'completed'

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
            {t.name} is run by <b style={{ color: 'var(--bone)' }}>{organizerName ?? who?.name ?? 'another organizer'}</b>.
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

  if (tabParam === 'manage' && completed) {
    return (
      <>
        <Crumb back={{ label: t.name, onClick: () => navigate(`/t/${t.id}`) }} />
        <Empty icon="trophy" title="This tournament is closed"
          sub="Results are final and editing is locked. You can still publish a closing announcement.">
          <button className="btn primary" type="button" onClick={() => navigate(`/t/${t.id}/announcements`)}>
            Open announcements
          </button>
        </Empty>
      </>
    )
  }

  const tabs = [...PUBLIC_TABS, ...(org && !completed ? ['manage'] : [])]
  const tab = tabs.includes(tabParam ?? '') ? tabParam! : 'bracket'
  const approved = tournamentId === undefined
    ? regsOf(s, t.id).filter(r => r.status === 'approved')
    : approvedTeams.data?.items ?? []
  const champion = winner.data?.championTeam
    ?? (tournamentData?.championTeamId == null
      ? null
      : approvedTeams.data?.items.find(candidate => candidate.id === tournamentData.championTeamId))
    ?? (USE_MOCK && t.champion ? team(s, t.champion) : null)
  const watchable = USE_MOCK && matchesOf(s, t.id).some(m => m.status === 'scheduled' && m.a && m.b)
  const rulesConfirmed = USE_MOCK || (!!eligibility.data && !eligibility.isPending && !eligibility.isError)
  const capacityConfirmed = USE_MOCK || (!!approvedTeams.data && !approvedTeams.isPending && !approvedTeams.isError)
  const accessLost = (query: { isError: boolean; error: unknown }) => {
    const status = typeof query.error === 'object' && query.error !== null && 'status' in query.error
      ? query.error.status : undefined
    return query.isError && (status === 401 || status === 403 || status === 404)
  }
  const approvedAccessLost = !USE_MOCK && accessLost(approvedTeams)
  const entryAccessLost = !USE_MOCK && (accessLost(eligibility) || approvedAccessLost)
  const entryFeedback = <>
    {!rulesConfirmed ? <div className="vstack">
      <span className="sub">{eligibility.isPending ? 'Loading entry rules…' : 'Entry rules are unconfirmed.'}</span>
      {eligibility.isError ? <button className="btn ghost" type="button"
        onClick={() => void eligibility.refetch()}>Retry entry rules</button> : null}
    </div> : null}
    {!capacityConfirmed ? <div className="vstack">
      <span className="sub">{approvedTeams.isPending ? 'Loading approved teams…' : 'Capacity is unconfirmed.'}</span>
      {approvedTeams.isError ? <button className="btn ghost" type="button"
        onClick={() => void approvedTeams.refetch()}>Retry approved teams</button> : null}
    </div> : null}
  </>

  return (
    <>
      <div className="journey-crumb"><Crumb back={{ label: 'Tournaments', onClick: () => navigate('/') }}>{t.name}</Crumb></div>

      {!USE_MOCK && tournamentQuery.isError ? <Panel quiet>
        <span className="error">Could not refresh the tournament. Showing the last loaded details.</span>
        <button className="btn ghost" type="button" onClick={() => void tournamentQuery.refetch()}>Retry tournament</button>
      </Panel> : null}

      {completed ? (
        <Banner kind="ok" icon="check">
          <b>This tournament is closed.</b>{' '}
          {champion ? `${champion.name} won it. ` : tournamentData?.championTeamId === null ? 'No champion was assigned. ' : ''}
          {tournamentData?.completedAt ? `Closed ${fmtDateTime(tournamentData.completedAt)}.` : 'Results are final.'}
        </Banner>
      ) : null}

      <header className={`spread tour-identity${tabParam ? ' tour-identity-compact' : ''}`}>
        <div>
          <h1 className="disp">{t.name}</h1>
          <p className="sub">{t.sport} · {formatName(t)} · {t.channel === 'onsite' ? 'On-site' : t.channel}</p>
          <div className="tag" style={{ marginTop: 6 }}>
            {org ? <><em>//</em> You run this tournament</> : `Run by ${organizerName ?? user(s, t.organizer)?.name ?? '—'}`}
          </div>
        </div>
        <div className="hstack">
          {champion ? <Badge kind="ok">{`Champion · ${champion.name}`}</Badge>
            : completed ? <Badge kind="ok">Completed</Badge>
            : t.status === 'public' ? <Badge kind="ok">Public</Badge>
              : t.status === 'private' ? <Badge kind="neutral">Private</Badge>
                : <Badge kind="warn">Pending review</Badge>}
          {USE_MOCK && champion ? (
            <button className="btn primary" type="button" onClick={() => navigate(`/mvp/${t.id}`)}>
              <Icon name="star" size={12} /> {USE_MOCK ? 'Vote MVP' : 'Match MVP'}
            </button>
          ) : null}
          {watchable ? (
            <button className="btn" type="button" onClick={() => navigate(`/watch/${t.id}`)}>
              <Icon name="match" size={12} /> Watch
            </button>
          ) : null}
        </div>
      </header>

      <div className="tour-page">
        <nav className="tabs" aria-label="Tournament sections">
          {tabs.map(k => <Link key={k} to={`/t/${t.id}/${k}`} className={`tab ${tab === k ? 'on' : ''}`}
            aria-current={tab === k ? 'page' : undefined}>{k[0].toUpperCase() + k.slice(1)}</Link>)}
        </nav>
        <details className="tour-context" open={!tabParam}>
          <summary>Details & entry</summary>
        <div className={`tour-overview${completed ? ' tour-overview-closed' : ''}`}>
          <section className="tour-overview-frame" aria-label="Tournament details" tabIndex={0}>
          <Panel className="tour-details">
            <h2 className="journey-heading">Details</h2>
            <Facts rows={[
              ['Sport', t.sport],
              ['Format', formatName(t)],
              ['Date', fmtDateOnly(t.date, t.date || 'Not set')],
              ['Registration opens', registrationDate(t.registrationStart)],
              ['Registration closes', registrationDate(t.registrationEnd)],
              ['Venue', <VenueLine name={t.venue} pin={t.pin} />],
              ['Played', t.channel],
              ['Entry', rulesConfirmed ? ruleSummary(t.rules) || 'open to everybody'
                : eligibility.isPending ? 'Loading…' : 'Unavailable'],
              /* Disabled prototype queries do not determine mock counts.
                 Only confirmed real-mode public reads determine real capacity. */
              ['Squads in', !USE_MOCK && approvedTeams.isPending
                ? <span className="sub">Loading…</span>
                : !capacityConfirmed
                  ? <span className="sub">Unavailable</span>
                  : <><b className="num">{approved.length}</b> <span className="sub">of {t.cap}</span></>],
              ['Run by', organizerName ?? user(s, t.organizer)?.name ?? '—'],
            ]} />
          </Panel>
          </section>
          {!completed ? <section className="tour-overview-frame" aria-label="Tournament entry" tabIndex={0}>
          {/* ส่งยอดทีมที่ผ่านการอนุมัติลงไปด้วย — โหมดจริง detail ไม่มี applications
              แผงสมัครเลยตกไปนับจาก store แล้วขึ้น "0 of 4" ทั้งที่มีทีมเข้าแล้ว */}
          <EntryPanel t={t} organizer={org} applications={tournamentData?.applications}
              approvedCount={tournamentId === undefined || !capacityConfirmed ? undefined : approved.length}
              sportTypeId={tournamentData?.sportTypeId}
              confirmation={{ rules: rulesConfirmed, capacity: capacityConfirmed, accessLost: entryAccessLost }}
              feedback={entryFeedback} />
          </section> : null}
        </div>
        </details>
        <section className="tour-workspace" aria-label="Tournament workspace">
          {tab === 'bracket' ? <BracketTab t={t} /> : null}
          {tab === 'dashboard' ? <DashboardTab tournamentId={t.id} /> : null}
          {tab === 'schedule' ? <ScheduleTab tournamentId={t.id} /> : null}
          {tab === 'leaderboard' ? <LeaderboardTab tournamentId={t.id} /> : null}
          {tab === 'announcements' ? <AnnouncementsTab t={t} org={org} /> : null}
          {tab === 'community' ? USE_MOCK ? <CommunityTab t={t} org={org} /> : <LiveCommunityTab tournamentId={tournamentId!} organizer={org} /> : null}
          {tab === 'manage' ? <ManageTab t={t} sub={sub} /> : null}
        </section>
        <div className="tour-support">

          {!USE_MOCK && !rulesConfirmed ? <section role="region" aria-label="Entry rules" tabIndex={0}><Panel quiet>
            <h2 className="journey-heading">Entry rules</h2>
            {eligibility.isPending ? <span className="sub">Loading entry rules…</span>
              : <span className="error">Unable to load entry rules. Eligibility is unconfirmed.</span>}
            {eligibility.isError ? <button className="btn ghost" type="button"
              onClick={() => void eligibility.refetch()}>Retry entry rules</button> : null}
          </Panel></section> : null}
          {tournamentId !== undefined ? <section role="region" aria-label="Approved teams" tabIndex={0}><Panel quiet>
            <h2 className="journey-heading">Approved teams</h2>
            {approvedTeams.isPending ? <span className="sub">Loading approved teams…</span> : null}
            {approvedTeams.isError ? <>
              <span className="error">Unable to load approved teams. Capacity is unconfirmed.</span>
              <button className="btn ghost" type="button" onClick={() => void approvedTeams.refetch()}>Retry approved teams</button>
            </> : null}
            {capacityConfirmed && approvedTeams.data?.items.length === 0 ? <span className="sub">No teams have been approved yet.</span> : null}
            {!approvedAccessLost ? approvedTeams.data?.items.map(approvedTeam => <div className="spread" key={approvedTeam.id}>
              {/* ชื่อกีฬาอยู่ใน sportTypes ที่หน้านี้ดึงมาอยู่แล้ว — เขียน "Sport #3" ทิ้งไว้
                  เป็นรหัสภายในที่ไม่มีความหมายกับคนอ่าน */}
              <span>{approvedTeam.name}<br /><span className="sub">
                {sportTypes.data?.items.find(sport => sport.id === approvedTeam.sportTypeId)?.name
                  ?? `Sport #${approvedTeam.sportTypeId}`}
              </span></span>
              <button className="btn ghost" type="button" onClick={() => navigate(`/team/${approvedTeam.id}`)}>View team</button>
            </div>) : null}
          </Panel></section> : null}

          {t.entryNotes ? (
            <section role="region" aria-label="Entry notes" tabIndex={0}><Panel quiet>
              <h2 className="journey-heading">Entry notes</h2>
              <div style={{ fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{t.entryNotes}</div>
            </Panel></section>
          ) : null}
        </div>
      </div>
    </>
  )
}
