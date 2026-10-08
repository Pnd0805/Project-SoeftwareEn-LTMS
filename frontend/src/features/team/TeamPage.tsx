/**
 * src/features/team/TeamPage.tsx
 *
 * The squad page. Anyone can open it; its leader also runs the squad from here —
 * the player pool, invitations, and the decisions that
 * belong to a leader.
 *
 * ── แหล่งข้อมูล ────────────────────────────────────────────────────────────
 * backend: GET /teams/:id · GET /teams/:id/members (403 = ไม่ใช่สมาชิก) ·
 *   DELETE /teams/:id/members/:uid ·
 *   GET/POST/DELETE /teams/:id/invitations · บทบาทของคนที่ดูอยู่ = role จาก GET /me/teams
 * โลโก้ใช้ URL จาก backend; โหมด mock เท่านั้น: โอนสิทธิ์หัวหน้า ·
 *   ผลแข่ง/เกียรติประวัติ (TeamRecord) · สถานะล็อกรายชื่อ
 *
 * ── กฎรายชื่อ ──────────────────────────────────────────────────────────────
 * ก่อนรายการที่ทีมได้ที่นั่งเริ่มแข่ง หัวหน้าทีมเพิ่มและถอนผู้เล่นได้ หลังเริ่มแล้ว
 * ทั้งสองอย่างล็อกจนรายการจบ (shared/rules.ts rosterLockOf) · ตัวจริง/ตัวสำรองเปลี่ยนได้
 * ตลอดเพราะไม่ได้เปลี่ยนว่าใครอยู่ในทีม แต่ตัวจริงเกินจำนวนที่กีฬาลงสนามได้ไม่ได้
 *
 * ── ทำไมไม่เทียบ currentUser.id กับ leader.id ─────────────────────────────
 * โหมด mock บัญชีเดโมห้าใบมี id 1–5 แต่ทีมใช้ id จาก numOf เทียบกันไม่มีวันเท่า
 * หัวหน้าทีมเดโมจึงไม่เคยเห็นส่วนจัดการ ใช้ role จาก /me/teams ซึ่งเป็นสัญญาของ backend แทน
 */
import { Avatar } from '../../components/kit/Avatar'
import { useEffect, useRef, useState } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Panel, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { ConfirmCard, Modal } from '../../components/kit/Modal'
import { TeamCrestView } from '../../components/kit/chips'
import { toTeamView } from '../../components/kit/viewModels'
import { ApiError, USE_MOCK } from '../../api/client'
import { parseBackendId } from '../../api/ids'
import {
  useBackendMyTeams, useBackendTeam, useBackendTeamMembers, useCancelTeamInvitation,
  useInviteMember, useKickMember, useTeamInvitations, useTransferLeader,
} from '../../hooks/useTeam'
import { useMe } from '../../hooks/useAuth'
import { useFollow, useSearchUsers } from '../../hooks/useUser'
import { useSportTypes } from '../../hooks/useReference'
import { EnterTournamentButton } from '../tournament/EnterTournamentButton'
import { useMyTournamentApplications } from '../../hooks/useTournament'
import { mockTeamApiIdFromRoute } from '../../mocks/routeIds'
import { findStoreTeam } from '../../mocks/teamBridge'
import { useLtms } from '../../shared/store'
import { minSquad, rosterLockOf } from '../../shared/rules'
import type { BackendTeamDto, BackendTeamMemberDto } from '../../types/team.dto'
import { TeamManage } from './TeamManage'
import { TeamRecord } from './TeamRecord'
import { fmtDateOnly } from '../../shared/dateFormat'

type Notice = { kind: 'ok' | 'warn'; text: string } | null

const errorMessage = (error: unknown, fallback = 'Something went wrong.') =>
  error instanceof Error ? error.message : fallback

const statusOf = (error: unknown) => (error as { status?: number } | null)?.status
const accessDenied = (error: unknown) => [401, 403].includes(statusOf(error) ?? 0)
const lockedTournamentsOf = (error: unknown) => error instanceof ApiError && Array.isArray(error.extra.tournaments)
  ? error.extra.tournaments as Array<{ tournamentId: number; name: string }>
  : []

export function TeamPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: currentUser } = useMe()
  const canReadPrivateTeamData = USE_MOCK || !!currentUser
  // String prototype links are resolved solely by the mock compatibility
  // boundary. Real backend links accept strict numeric database IDs only.
  const teamId = parseBackendId(id) ?? (USE_MOCK ? mockTeamApiIdFromRoute(id) : undefined)
  const team = useBackendTeam(teamId)
  const members = useBackendTeamMembers(teamId, canReadPrivateTeamData)
  const myTeams = useBackendMyTeams(canReadPrivateTeamData)
  const myApplications = useMyTournamentApplications(canReadPrivateTeamData)

  if (teamId === undefined) {
    return <Empty icon="team" title="Invalid team link"><button className="btn" type="button" onClick={() => navigate('/teams')}>Back to teams</button></Empty>
  }
  if (team.isPending) return <Panel><span className="sub">Loading team…</span></Panel>
  if (team.isError || !team.data) {
    return (
      <Empty icon="team" title={statusOf(team.error) === 404 ? 'No such squad' : 'Could not load this team'}>
        <p className="sub">{errorMessage(team.error, 'Unable to load this team.')}</p>
        <button className="btn" type="button" onClick={() => team.refetch()}>Try again</button>
      </Empty>
    )
  }

  const data = team.data
  const isLeader = canReadPrivateTeamData && !accessDenied(myTeams.error)
    && !!myTeams.data?.items.some(x => x.id === data.id && x.role === 'leader')
  // เปลี่ยนทีม/สิทธิ์แล้วทิ้งแบบร่างส่วนตัว แต่สลับแท็บในทีมเดิมเก็บไว้
  return <TeamDetails key={`${data.id}:${isLeader}:${canReadPrivateTeamData}`} data={data}
    members={members} isLeader={isLeader} canReadPrivateTeamData={canReadPrivateTeamData}
    userId={currentUser?.id} myApplications={myApplications} />
}

function TeamDetails({ data, members, isLeader, canReadPrivateTeamData, userId, myApplications }: {
  data: BackendTeamDto
  members: ReturnType<typeof useBackendTeamMembers>
  isLeader: boolean
  canReadPrivateTeamData: boolean
  userId: number | undefined
  myApplications: ReturnType<typeof useMyTournamentApplications>
}) {
  const navigate = useNavigate()
  const s = useLtms()
  const sportTypes = useSportTypes()
  const follow = useFollow(userId, `team:${data.id}`)
  const [activeTab, setActiveTab] = useState('members')
  const focusInvite = useRef(false)
  useEffect(() => {
    if (activeTab === 'invites' && focusInvite.current) {
      document.getElementById('team-invite-search')?.focus()
      focusInvite.current = false
    }
  }, [activeTab])
  const openInvites = () => {
    if (activeTab === 'invites') document.getElementById('team-invite-search')?.focus()
    else { focusInvite.current = true; setActiveTab('invites') }
  }
  const readableApplications = accessDenied(myApplications.error) ? [] : myApplications.data?.items ?? []
  const approvedIn = readableApplications
    .filter(application => application.team.id === data.id && application.status === 'approved')
  /* ของที่ backend ยังไม่มีให้ — อ่านจาก store เฉพาะโหมด mock */
  const storeTeam = USE_MOCK ? findStoreTeam(data.id) : undefined
  const lock = storeTeam ? rosterLockOf(s, storeTeam) : null
  /**
   * ล็อกรายชื่อเมื่อทีมได้ที่นั่งในรายการแล้ว (FR-TM-04)
   *
   * ใบสมัครถูกตรวจ hard filter ณ ตอนยื่น — ถ้าเปลี่ยนตัวผู้เล่นหลังผู้จัดรับเข้าแล้ว
   * ทีมที่ลงแข่งจริงจะไม่ใช่ทีมที่ผ่านการตรวจ
   *
   * หลัง application-squad merge (`43bacda`) ล็อกผูกกับใบสมัคร `approved`
   * ไม่ใช่สถานะทัวร์ ดังนั้น `completed` ก็ยังล็อกอยู่ตามกฎ Q2-ค
   */
  const committedTo = approvedIn[0]
  const pendingIn = readableApplications
    .find(application => application.team.id === data.id && application.status === 'pending')
  const currentEntry = committedTo ?? pendingIn
  const sport = sportTypes.data?.items.find(x => x.id === data.sportTypeId)
  const minPlayers = storeTeam ? minSquad(storeTeam) : sport?.minMembers
  const short = minPlayers !== undefined ? Math.max(0, minPlayers - data.memberCount) : 0

  return (
    <>
      <div className="journey-crumb"><Crumb back={{ label: userId !== undefined ? 'Teams' : 'Tournaments', onClick: () => navigate(userId !== undefined ? '/teams' : '/') }}>{data.name}</Crumb></div>

      <header className={`team-poster ${data.name.length > 60 ? 'long-name' : ''}`}>
        <div className="team-poster-identity">
          {storeTeam && !storeTeam.logo ? <TeamCrestView team={toTeamView(storeTeam)} size={64} />
            : <Avatar name={data.name} avatarUrl={storeTeam?.logo ?? data.logoUrl} size={64} alt={data.name}
                style={{ borderRadius: '50%', border: '2px solid var(--line)' }} />}
          <div className="vstack team-poster-copy">
            <h1 className="disp">{data.name}</h1>
            <span className="hstack team-poster-meta">
              <Badge kind={data.readinessStatus === 'Ready' ? 'ok' : 'warn'}>{data.readinessStatus}</Badge>
              <Badge kind={data.officialStatus === 'Official' ? 'ok' : 'neutral'}>{data.officialStatus}</Badge>
              {sport ? <Badge kind="neutral">{sport.name}</Badge> : null}
            </span>
            <span className="sub">Leader · <span>{data.leader.fullName}</span></span>
          </div>
        </div>
        <div className="hstack team-poster-actions">
          {isLeader && myApplications.isSuccess && !lock && !committedTo ? (
            <button className={`btn ${data.readinessStatus === 'Forming' ? 'primary' : 'ghost'}`} type="button" onClick={openInvites}><Icon name="plus" size={13} /> Invite players</button>
          ) : null}
          {isLeader && currentEntry ? (
            <button className="btn" type="button" onClick={() => navigate(`/t/${currentEntry.tournament.id}`)}>View entry <Icon name="chev" size={11} /></button>
          ) : null}
          {/* ประตูที่สองของการสมัครแข่ง — เริ่มจากทีม เลือกรายการทีหลัง */}
          {!USE_MOCK && isLeader && data.readinessStatus === 'Ready' ? (
            <EnterTournamentButton team={data} variant="primary" />
          ) : null}
          {userId !== undefined && USE_MOCK ? (
            <button className={`btn ${follow.isFollowing ? 'ghost' : 'primary'}`} type="button"
              onClick={() => follow.toggle.mutate()} disabled={follow.toggle.isPending}>
              {follow.isFollowing ? 'Following' : 'Follow this squad'}
            </button>
          ) : null}
        </div>
      </header>

      {data.readinessStatus === 'Forming' && short > 0 ? (
        <Banner kind="warn" icon="team">
          <b>{short} more accepted member{short === 1 ? '' : 's'} and this squad is Ready.</b>{' '}
          A Forming squad can't register for a tournament.
        </Banner>
      ) : null}

      {isLeader && (lock || committedTo) ? (
        <Banner kind="warn">
          <b>The roster is locked by the approved entry in {lock?.name ?? committedTo?.tournament.name}.</b>{' '}
          Players can't be added or removed — the squad that plays has to be the squad the entry
          rules were checked against.
        </Banner>
      ) : null}

      {isLeader && !committedTo && pendingIn ? (
        <Banner kind="warn">
          <b>{pendingIn.tournament.name} has not decided on this squad yet.</b>{' '}
          Changing the roster now means the organizer approves a squad that is not the one the entry
          rules were checked against.
        </Banner>
      ) : null}

      {isLeader ? (
        <Tabs.Root className="team-workspace-tabs" value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="team-tab-bar" aria-label="Team workspace" activateOnFocus>
            <Tabs.Tab className="team-tab" value="members">Members</Tabs.Tab>
            <Tabs.Tab className="team-tab" value="invites">Invites</Tabs.Tab>
            <Tabs.Tab className="team-tab" value="manage">Manage</Tabs.Tab>
          </Tabs.List>
          {/* keepMounted เก็บคำค้น/แบบร่าง โดยแท็บที่ซ่อนยัง inert และไม่อยู่ในลำดับโฟกัส */}
          <Tabs.Panel className="team-tab-panel" value="members" keepMounted>
            <RosterPanel data={data} members={members} isLeader={isLeader}
              lockName={lock?.name ?? committedTo?.tournament.name ?? null} minPlayers={minPlayers}
              canViewMembers={canReadPrivateTeamData} />
          </Tabs.Panel>
          <Tabs.Panel className="team-tab-panel" value="invites" keepMounted>
            <InvitePanel data={data} lockName={lock?.name ?? committedTo?.tournament.name ?? null}
              memberIds={(members.data?.items ?? []).map(m => m.userId)} />
          </Tabs.Panel>
          <Tabs.Panel className="team-tab-panel" value="manage" keepMounted>
            <TeamManage data={data} storeTeam={storeTeam} />
          </Tabs.Panel>
        </Tabs.Root>
      ) : (
        <RosterPanel data={data} members={members} isLeader={false}
          lockName={lock?.name ?? committedTo?.tournament.name ?? null} minPlayers={minPlayers}
          canViewMembers={canReadPrivateTeamData} />
      )}

      {storeTeam ? <TeamRecord t={storeTeam} /> : null}
    </>
  )
}

/**
 * คลังผู้เล่น — หัวหน้าทีมถอนผู้เล่นและโอนสิทธิ์หัวหน้าได้จากตรงนี้
 * ถอนได้จนกว่ารายการที่ทีมได้ที่นั่งจะเริ่มแข่ง
 */
function RosterPanel({ data, members, isLeader, lockName, minPlayers, canViewMembers }: {
  data: BackendTeamDto
  members: ReturnType<typeof useBackendTeamMembers>
  isLeader: boolean
  lockName: string | null
  minPlayers: number | undefined
  canViewMembers: boolean
}) {
  const navigate = useNavigate()
  const kick = useKickMember(data.id)
  const transfer = useTransferLeader(data.id)
  const [removing, setRemoving] = useState<BackendTeamMemberDto | null>(null)
  const [handing, setHanding] = useState<BackendTeamMemberDto | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const forbidden = canViewMembers && statusOf(members.error) === 403
  const rows = canViewMembers && !accessDenied(members.error) ? members.data?.items ?? [] : []
  const removalLocks = lockedTournamentsOf(kick.error)
  /* เดิมนับเฉพาะตัวจริง — migration 019 ตัดตัวจริง/ตัวสำรองระดับทีมออกแล้ว เหลือ
     คำถามเดียวที่ยังมีความหมาย: คนในคลังพอจะส่งลงแข่งตามขั้นต่ำของกีฬาไหม */
  const squadSize = rows.length
  const dropsToForming = minPlayers !== undefined && data.memberCount - 1 < minPlayers

  return (
    <Panel quiet className="team-roster journey-data">
      <div className="spread">
        <h2 className="journey-heading">Members <span className="journey-count">{data.memberCount}</span></h2>
        <span className="hstack" style={{ gap: 10 }}>
          {rows.length ? (
            <span className="sub">
              {data.maxMembers !== null ? `Players ${squadSize} / ${data.maxMembers}`
                : minPlayers === undefined ? `Players ${squadSize}`
                  : squadSize >= minPlayers ? `Players ${squadSize} · ${minPlayers} needed to enter`
                    : `Players ${squadSize} of the ${minPlayers} needed to enter`}
            </span>
          ) : null}
          {isLeader ? (
            <span className="sub">
              {lockName ? 'Locked until the tournament ends' : 'Add or remove players until a tournament you are in starts'}
            </span>
          ) : null}
        </span>
      </div>

      {notice ? <div role="status"><Banner kind={notice.kind}>{notice.text}</Banner></div> : null}
      {kick.isError ? (
        <Banner kind="crit">
          <b>Couldn't remove the player.</b> {errorMessage(kick.error)}
          {removalLocks.length ? <><br />Withdraw the squad from {removalLocks.map(item => item.name).join(', ')} first.
            <br /><button className="btn ghost" type="button" onClick={() => navigate('/teams')}>Manage tournament applications</button></> : null}
        </Banner>
      ) : null}
      {transfer.isError ? <Banner kind="crit"><b>Couldn't hand over the captaincy.</b> {errorMessage(transfer.error)}</Banner> : null}

      {canViewMembers && members.isPending ? <span className="sub">Loading members…</span> : null}
      {!canViewMembers ? <span className="sub">Sign in to view this squad&apos;s roster.</span> : null}
      {forbidden ? <span className="sub">You do not have access to this roster.</span> : null}
      {canViewMembers && members.isError && !forbidden ? (
        <div className="hstack">
          <span className="sub">{errorMessage(members.error)}</span>
          <button className="btn ghost" type="button" onClick={() => void members.refetch()}>Try again</button>
        </div>
      ) : null}
      {canViewMembers && members.isSuccess && !rows.length ? <span className="sub">No members found.</span> : null}

      {rows.length ? (
        <TableWrap label="Team members">
          <table>
            <thead><tr><th>Player</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map(member => {
                const captain = member.userId === data.leader.id
                return (
                  <tr key={member.userId}>
                    <td>
                      <span className="hstack">
                        <Avatar name={member.fullName} avatarUrl={member.avatarUrl} />
                        {/* กดชื่อเพื่อเปิดโปรไฟล์สาธารณะ (GET /users/:id) */}
                        <button className="tchip link" type="button"
                          onClick={() => navigate(`/player/${member.userId}`)}>{member.fullName}</button>
                        {captain ? <span className="tag"> · captain</span> : null}
                      </span>
                    </td>
                    {/* ช่องตัวจริง/ตัวสำรองหายไปพร้อม migration 019 — ทีมเป็นคลังผู้เล่น
                        ใครลงแข่งเลือกตอนสมัครแต่ละทัวร์แทน (application_players) */}
                    <td className="sub">{fmtDateOnly(member.joinedAt)}</td>
                    <td>
                      <span className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        {isLeader && !captain && (USE_MOCK || data.officialStatus === "Official") ? (
                          <button className="btn ghost" type="button" disabled={transfer.isPending}
                            aria-label={`Hand over captaincy to ${member.fullName}`}
                            onClick={() => { transfer.reset(); setNotice(null); setHanding(member) }}>
                            Hand over
                          </button>
                        ) : null}
                        {isLeader && !captain ? (
                          <button className="btn ghost" type="button" disabled={!!lockName || kick.isPending}
                            aria-label={`${kick.isPending && kick.variables === member.userId ? 'Removing' : 'Remove'} ${member.fullName}`}
                            title={lockName ? `Locked while ${lockName} is under way` : undefined}
                            onClick={() => { kick.reset(); setNotice(null); setRemoving(member) }}>
                            {kick.isPending && kick.variables === member.userId ? 'Removing…' : 'Remove'}
                          </button>
                        ) : null}
                        <button className="btn ghost" type="button" aria-label={`Profile for ${member.fullName}`}
                          onClick={() => navigate(`/player/${member.userId}`)}>
                          Profile <Icon name="chev" size={11} />
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      ) : null}

      {/* ทีมทั่วไปยังไม่เปิดโอนสิทธิ์ ส่วน Official ใช้คำร้องตาม handler เดิม */}
      {isLeader && !USE_MOCK && data.officialStatus !== 'Official' ? (
        <span className="sub">Leadership transfer is unavailable for this team.</span>
      ) : null}

      <Modal open={!!removing} onClose={() => setRemoving(null)} className="team-dialog"
        title={removing ? `Remove ${removing.fullName}?` : ''}>
        <ConfirmCard danger ok="Remove" onCancel={() => setRemoving(null)}
          body={removing
            ? `${removing.fullName} leaves ${data.name} and comes off every entry list that has not finished.`
              + (dropsToForming ? ` The squad drops below ${minPlayers} players and goes back to Forming until someone else joins.` : '')
            : ''}
          onConfirm={() => {
            if (!removing) return
            const target = removing
            setRemoving(null)
            kick.mutate(target.userId, {
              onSuccess: () => setNotice({ kind: 'warn', text: `${target.fullName} was removed from ${data.name}.` }),
            })
          }} />
      </Modal>

      <Modal open={!!handing} onClose={() => setHanding(null)} className="team-dialog"
        title={handing ? `Make ${handing.fullName} the captain?` : ''}>
        <ConfirmCard ok="Hand over" onCancel={() => setHanding(null)}
          body={handing && !USE_MOCK ? `Request admin approval to make ${handing.fullName} the leader. The current leader keeps their rights until approval.` : handing ? `${handing.fullName} becomes the team leader. You stay in the squad, but only the new leader can manage it.` : ''}
          onConfirm={() => {
            if (!handing) return
            const target = handing
            setHanding(null)
            transfer.mutate({ targetUserId: target.userId }, {
              onSuccess: () => setNotice({ kind: 'ok', text: USE_MOCK ? `${target.fullName} is now the captain of ${data.name}.` : `Transfer request sent for ${target.fullName}. Waiting for admin approval.` }),
            })
          }} />
      </Modal>
    </Panel>
  )
}

/**
 * เพิ่มผู้เล่น — การเพิ่มคือการส่งคำเชิญ คนนั้นเข้าทีมเมื่อกดรับ (FR-TM-02, FR-TM-03)
 * ล็อกเมื่อทีมเริ่มแข่งแล้ว และคนใหม่ต้องผ่านเงื่อนไขของรายการที่ทีมได้ที่นั่งไว้
 */
function InvitePanel({ data, lockName, memberIds }: {
  data: BackendTeamDto
  lockName: string | null
  memberIds: number[]
}) {
  const invitations = useTeamInvitations(data.id)
  const invite = useInviteMember(data.id)
  const cancel = useCancelTeamInvitation(data.id)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const users = useSearchUsers(search, !lockName)
  const sent = invitations.data?.items ?? []
  const pendingIds = new Set(sent.filter(i => i.status === 'pending').map(i => i.invitedUser.id))
  const results = (users.data?.items ?? []).filter(p => !memberIds.includes(p.id) && !pendingIds.has(p.id))
  const typed = search.trim().length >= 3

  return (
    <Panel quiet className="team-invitations journey-data">
      <h2 className="journey-heading">Invite players</h2>
      <div className="sub">
        Players join after accepting. Tournament entry rules still apply.
      </div>

      {lockName ? (
        <Banner kind="warn">
          <b>Adding players is locked.</b> {data.name} has an approved entry in {lockName}; the lock follows that application, even after the tournament closes.
        </Banner>
      ) : (
        <>
          <input id="team-invite-search" value={search} placeholder="Name or email" aria-label="Search users to invite" autoComplete="off"
            onChange={e => { setSearch(e.target.value); invite.reset(); setNotice(null) }} />
          {notice ? <div role="status"><Banner kind={notice.kind}>{notice.text}</Banner></div> : null}
          {invite.isError ? <Banner kind="crit"><b>Couldn't send the invitation.</b> {errorMessage(invite.error)}</Banner> : null}
          {!typed ? <span className="sub">Type at least three letters.</span> : null}
          {typed && users.isPending ? <span className="sub">Searching users…</span> : null}
          {typed && users.isError ? <span className="sub">{errorMessage(users.error)}</span> : null}
          {typed && users.isSuccess && !results.length ? <span className="sub">Nobody left to invite matches that.</span> : null}
          {results.length ? (
            <TableWrap label="Players to invite">
              <table>
                <tbody>
                  {results.map(person => (
                    <tr key={person.id}>
                      <td><span className="hstack"><Avatar name={person.fullName} avatarUrl={person.avatarUrl} />{person.fullName}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn primary" type="button" disabled={invite.isPending}
                          aria-label={`${invite.isPending && invite.variables?.userId === person.id ? 'Inviting' : 'Invite'} ${person.fullName}`}
                          onClick={() => {
                            setNotice(null)
                            invite.mutate({ userId: person.id }, {
                              onSuccess: () => setNotice({ kind: 'ok', text: `Invitation sent to ${person.fullName} — it counts once they accept.` }),
                            })
                          }}>
                          {invite.isPending && invite.variables?.userId === person.id ? 'Inviting…' : 'Invite'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : null}
        </>
      )}

      <h3 className="journey-subheading">Sent invitations</h3>
      {cancel.isError ? <Banner kind="crit"><b>Couldn't cancel the invitation.</b> {errorMessage(cancel.error)}</Banner> : null}
      {invitations.isPending ? <span className="sub">Loading sent invitations…</span> : null}
      {invitations.isError ? <span className="sub">{errorMessage(invitations.error)}</span> : null}
      {invitations.isSuccess && !sent.length ? <span className="sub">No invitations sent yet.</span> : null}
      {sent.length ? (
        <TableWrap label="Sent invitations">
          <table>
            <thead><tr><th>Invited</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {sent.map(invitation => (
                <tr key={invitation.id}>
                  <td>{invitation.invitedUser.fullName}</td>
                  <td>
                    {invitation.status === 'pending' ? <Badge kind="warn">Waiting</Badge>
                      : invitation.status === 'accepted' ? <Badge kind="ok">Joined</Badge>
                        : <Badge kind="neutral">{invitation.status}</Badge>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {invitation.status === 'pending' ? (
                      <button className="btn ghost" type="button" disabled={cancel.isPending}
                        aria-label={`Cancel invitation to ${invitation.invitedUser.fullName}`}
                        onClick={() => {
                          setNotice(null)
                          cancel.mutate(invitation.id, { onSuccess: () => setNotice({ kind: 'ok', text: `Invitation to ${invitation.invitedUser.fullName} cancelled.` }) })
                        }}>
                        {cancel.isPending && cancel.variables === invitation.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}
    </Panel>
  )
}
