/**
 * src/features/tournament/TournamentPage.tsx
 *
 * The heavy page splits in half: tabs and their content left, a sticky rail of
 * facts right. Below 900px the rail drops under the content. The rail carries
 * the .facts card (sport, format, date, venue, channel, entry rules, squads in,
 * organizer), the entry panel, and the organizer's entry notes.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Facts, Panel, Tabs, VenueLine } from '../../components/kit/primitives'
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

const PUBLIC_TABS = ['bracket', 'dashboard', 'schedule', 'leaderboard', 'announcements', 'community']

export function TournamentPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id, tab: tabParam, sub } = useParams()
  const tournamentId = parseBackendId(id)
  const { data: tournamentData, isPending } = useTournament(tournamentId)
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

  /* query ที่ถูก disable (id ไม่ใช่ตัวเลข) ก็รายงาน isPending เหมือนกัน — ถ้าไม่กัน
     ลิงก์ของ prototype จะค้างที่ "Loading tournament" ตลอดกาลแทนที่จะบอกว่าไม่มี */
  if (tournamentId !== undefined && isPending && !legacyTournament) {
    return <Empty title="Loading tournament" />
  }

  if (!t) {
    const prototypeLink = !USE_MOCK && tournamentId === undefined
    return (
      <Empty icon="warn" title="That tournament doesn't exist"
        sub={prototypeLink
          ? 'That link points at prototype data, which only exists in mock mode.'
          : undefined}>
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

  return (
    <>
      <Crumb back={{ label: 'Tournaments', onClick: () => navigate('/') }}>{t.name}</Crumb>

      {completed ? (
        <Banner kind="ok" icon="check">
          <b>This tournament is closed.</b>{' '}
          {champion ? `${champion.name} won it. ` : tournamentData?.championTeamId === null ? 'No champion was assigned. ' : ''}
          {tournamentData?.completedAt ? `Closed ${new Date(tournamentData.completedAt).toLocaleString()}.` : 'Results are final.'}
        </Banner>
      ) : null}

      <div className="spread">
        <div>
          <div className="tag"><em>//</em> {t.sport} · {formatName(t)} · {t.channel}</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>{t.name}</h1>
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
          {(USE_MOCK ? !!champion : completed) ? (
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
          {tab === 'dashboard' ? <DashboardTab tournamentId={t.id} /> : null}
          {tab === 'schedule' ? <ScheduleTab tournamentId={t.id} /> : null}
          {tab === 'leaderboard' ? <LeaderboardTab tournamentId={t.id} /> : null}
          {tab === 'announcements' ? <AnnouncementsTab t={t} org={org} /> : null}
          {tab === 'community' ? USE_MOCK ? <CommunityTab t={t} org={org} /> : <LiveCommunityTab tournamentId={tournamentId!} organizer={org} /> : null}
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
              /* id ของ store ('t-fb') ไม่ยิง GET /tournaments/:id/teams — query ถูกปิดไว้และ
                 TanStack v5 ถือว่า query ที่ปิดโดยยังไม่มีข้อมูลเป็น pending ตลอด ถ้าเช็ค
                 isPending ก่อนจะค้างที่ Loading ทุกรายการใน seed จึงเช็คเฉพาะตอนมี id ตัวเลข */
              ['Squads in', tournamentId !== undefined && approvedTeams.isPending
                ? <span className="sub">Loading…</span>
                : tournamentId !== undefined && approvedTeams.isError
                  ? <span className="sub">Unavailable</span>
                  : <><b className="num">{approved.length}</b> <span className="sub">of {t.cap}</span></>],
              ['Run by', organizerName ?? user(s, t.organizer)?.name ?? '—'],
            ]} />
          </Panel>
          {tournamentId !== undefined ? <Panel quiet>
            <span className="tag"><em>//</em> Approved teams</span>
            {approvedTeams.isPending ? <span className="sub">Loading approved teams…</span> : null}
            {approvedTeams.isError ? <span className="sub">Unable to load approved teams.</span> : null}
            {approvedTeams.data?.items.length === 0 ? <span className="sub">No teams have been approved yet.</span> : null}
            {approvedTeams.data?.items.map(approvedTeam => <div className="spread" key={approvedTeam.id}>
              {/* ชื่อกีฬาอยู่ใน sportTypes ที่หน้านี้ดึงมาอยู่แล้ว — เขียน "Sport #3" ทิ้งไว้
                  เป็นรหัสภายในที่ไม่มีความหมายกับคนอ่าน */}
              <span>{approvedTeam.name}<br /><span className="sub">
                {sportTypes.data?.items.find(sport => sport.id === approvedTeam.sportTypeId)?.name
                  ?? `Sport #${approvedTeam.sportTypeId}`}
              </span></span>
              <button className="btn ghost" type="button" onClick={() => navigate(`/team/${approvedTeam.id}`)}>View team</button>
            </div>)}
          </Panel> : null}
          {/* ส่งยอดทีมที่ผ่านการอนุมัติลงไปด้วย — โหมดจริง detail ไม่มี applications
              แผงสมัครเลยตกไปนับจาก store แล้วขึ้น "0 of 4" ทั้งที่มีทีมเข้าแล้ว */}
          {completed ? null : (
            <EntryPanel t={t} applications={tournamentData?.applications}
              approvedCount={tournamentId === undefined ? undefined : approved.length}
              sportTypeId={tournamentData?.sportTypeId} />
          )}
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
