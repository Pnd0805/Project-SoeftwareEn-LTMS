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
 * โหมด mock เท่านั้น (backend ยังไม่มี route): โลโก้ · โอนสิทธิ์หัวหน้า ·
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
import { useState } from 'react'
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
import { useMyTournamentApplications, useTournamentsByIds } from '../../hooks/useTournament'
import { mockTeamApiIdFromRoute } from '../../mocks/routeIds'
import { findStoreTeam } from '../../mocks/teamBridge'
import { useLtms } from '../../shared/store'
import { minSquad, rosterLockOf } from '../../shared/rules'
import type { BackendTeamDto, BackendTeamMemberDto } from '../../types/team.dto'
import { TeamManage } from './TeamManage'
import { TeamRecord } from './TeamRecord'

type Notice = { kind: 'ok' | 'warn'; text: string } | null

/** ทัวร์ที่ไม่ล็อกรายชื่อแล้ว — ชุดเดียวกับ findLockingTournamentOfTeam ของ backend (B6) */
const ROSTER_FREE = new Set<string>(['completed', 'auto_deleted', 'rejected'])

const errorMessage = (error: unknown, fallback = 'Something went wrong.') =>
  error instanceof Error ? error.message : fallback

const statusOf = (error: unknown) => (error as { status?: number } | null)?.status
const lockedTournamentsOf = (error: unknown) => error instanceof ApiError && Array.isArray(error.extra.tournaments)
  ? error.extra.tournaments as Array<{ tournamentId: number; name: string }>
  : []

export function TeamPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const s = useLtms()
  const { data: currentUser } = useMe()
  const canReadPrivateTeamData = USE_MOCK || !!currentUser
  // String prototype links are resolved solely by the mock compatibility
  // boundary. Real backend links accept strict numeric database IDs only.
  const teamId = parseBackendId(id) ?? (USE_MOCK ? mockTeamApiIdFromRoute(id) : undefined)
  const team = useBackendTeam(teamId)
  const members = useBackendTeamMembers(teamId, canReadPrivateTeamData)
  const myTeams = useBackendMyTeams(canReadPrivateTeamData)
  const myApplications = useMyTournamentApplications(canReadPrivateTeamData)
  const sportTypes = useSportTypes()
  const follow = useFollow(currentUser?.id, `team:${id ?? ''}`)
  /* B6 ล็อกรายชื่อเฉพาะทัวร์ที่ "ยังไม่จบ" — ต้องรู้สถานะของทัวร์ที่ทีมนี้ได้ที่นั่ง
     เรียกตรงนี้เพราะ hook ต้องถูกเรียกทุกรอบ ก่อนทางออกก่อนกำหนดข้างล่าง */
  const approvedIn = (myApplications.data?.items ?? [])
    .filter(application => application.team.id === team.data?.id && application.status === 'approved')
  const approvedTournaments = useTournamentsByIds(approvedIn.map(application => application.tournament.id))

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
  const isLeader = !!myTeams.data?.items.some(x => x.id === data.id && x.role === 'leader')
  /* ของที่ backend ยังไม่มีให้ — อ่านจาก store เฉพาะโหมด mock */
  const storeTeam = USE_MOCK ? findStoreTeam(data.id) : undefined
  const lock = storeTeam ? rosterLockOf(s, storeTeam) : null
  /**
   * ล็อกรายชื่อเมื่อทีมได้ที่นั่งในรายการแล้ว (FR-TM-04)
   *
   * ใบสมัครถูกตรวจ hard filter ณ ตอนยื่น — ถ้าเปลี่ยนตัวผู้เล่นหลังผู้จัดรับเข้าแล้ว
   * ทีมที่ลงแข่งจริงจะไม่ใช่ทีมที่ผ่านการตรวจ
   *
   * ตั้งแต่ B6 (`c43f497`) backend บังคับเองแล้ว (T07/T08/T09/T13 ตอบ 409 ROSTER_LOCKED)
   * และปลดล็อกเมื่อทัวร์จบ ถูกปัดตก หรือถูกลบ — ถ้าเราไม่เช็คสถานะด้วย ทีมที่เคยเข้าทัวร์
   * ที่จบไปนานแล้วจะถูกล็อกค้างตลอดกาลทั้งที่ server ยอมให้แก้
   */
  const stillRunning = new Set(
    approvedTournaments.flatMap(q => (q.data && !ROSTER_FREE.has(q.data.status) ? [q.data.id] : [])),
  )
  /* โหมด mock ไม่มีสถานะทัวร์จาก API (useTournamentsByIds ปิดอยู่) — ตัวล็อกหลักคือ
     rosterLockOf ของ store อยู่แล้ว ตรงนี้จึงคงพฤติกรรมเดิมไว้ */
  const committedTo = USE_MOCK ? approvedIn[0] : approvedIn.find(a => stillRunning.has(a.tournament.id))
  const pendingIn = (myApplications.data?.items ?? [])
    .find(application => application.team.id === team.data?.id && application.status === 'pending')
  const sport = sportTypes.data?.items.find(x => x.id === data.sportTypeId)
  const minPlayers = storeTeam ? minSquad(storeTeam) : sport?.minMembers
  const short = minPlayers !== undefined ? Math.max(0, minPlayers - data.memberCount) : 0

  return (
    <>
      <Crumb back={{ label: 'Tournaments', onClick: () => navigate('/') }}>{data.name}</Crumb>

      <div className="spread">
        <span className="hstack" style={{ gap: 16 }}>
          {storeTeam
            ? <TeamCrestView team={toTeamView(storeTeam)} size={64} />
            : <span className="avatar" style={{ width: 64, height: 64, fontSize: 26 }}>{data.name.slice(0, 1)}</span>}
          <span className="vstack" style={{ gap: 5 }}>
            <span className="disp" style={{ fontSize: 32 }}>{data.name}</span>
            <span className="hstack">
              <Badge kind={data.readinessStatus === 'Ready' ? 'ok' : 'warn'}>{data.readinessStatus}</Badge>
              <Badge kind={data.officialStatus === 'Official' ? 'ok' : 'neutral'}>{data.officialStatus}</Badge>
              {sport ? <Badge kind="neutral">{sport.name}</Badge> : null}
              <span className="tag">Captain <em>{data.leader.fullName}</em></span>
            </span>
          </span>
        </span>
        <span className="hstack">
          {/* ประตูที่สองของการสมัครแข่ง — เริ่มจากทีม เลือกรายการทีหลัง */}
          {!USE_MOCK && isLeader && data.readinessStatus === 'Ready' ? (
            <EnterTournamentButton team={data} variant="primary" />
          ) : null}
          {currentUser ? (
            <button className={`btn ${follow.isFollowing ? 'ghost' : 'primary'}`} type="button"
              onClick={() => follow.toggle.mutate()} disabled={follow.toggle.isPending}>
              {follow.isFollowing ? 'Following' : 'Follow this squad'}
            </button>
          ) : null}
        </span>
      </div>

      {data.readinessStatus === 'Forming' && short > 0 ? (
        <Banner kind="warn" icon="team">
          <b>{short} more accepted member{short === 1 ? '' : 's'} and this squad is Ready.</b>{' '}
          A Forming squad can't register for a tournament.
        </Banner>
      ) : null}

      {isLeader && (lock || committedTo) ? (
        <Banner kind="warn">
          <b>The roster is locked while {lock?.name ?? committedTo?.tournament.name} is under way.</b>{' '}
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

      <RosterPanel data={data} members={members} isLeader={isLeader}
        lockName={lock?.name ?? committedTo?.tournament.name ?? null} minPlayers={minPlayers}
        canViewMembers={canReadPrivateTeamData} />

      {isLeader ? (
        <InvitePanel data={data} lockName={lock?.name ?? committedTo?.tournament.name ?? null}
          memberIds={(members.data?.items ?? []).map(m => m.userId)} />
      ) : null}

      {isLeader ? <TeamManage data={data} storeTeam={storeTeam} /> : null}

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
  const forbidden = statusOf(members.error) === 403
  const rows = members.data?.items ?? []
  const removalLocks = lockedTournamentsOf(kick.error)
  /* เดิมนับเฉพาะตัวจริง — migration 019 ตัดตัวจริง/ตัวสำรองระดับทีมออกแล้ว เหลือ
     คำถามเดียวที่ยังมีความหมาย: คนในคลังพอจะส่งลงแข่งตามขั้นต่ำของกีฬาไหม */
  const squadSize = rows.length
  const dropsToForming = minPlayers !== undefined && data.memberCount - 1 < minPlayers

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Squad · {data.memberCount}</span>
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

      {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}
      {kick.isError ? (
        <Banner kind="crit">
          <b>Couldn't remove the player.</b> {errorMessage(kick.error)}
          {removalLocks.length ? <><br />Withdraw the squad from {removalLocks.map(item => item.name).join(', ')} first.
            <br /><button className="btn ghost" type="button" onClick={() => navigate('/teams')}>Manage tournament applications</button></> : null}
        </Banner>
      ) : null}
      {transfer.isError ? <Banner kind="crit"><b>Couldn't hand over the captaincy.</b> {errorMessage(transfer.error)}</Banner> : null}

      {members.isPending ? <span className="sub">Loading members…</span> : null}
      {!canViewMembers ? <span className="sub">Sign in to view this squad&apos;s roster.</span> : null}
      {forbidden ? <span className="sub">Only team members can view this roster.</span> : null}
      {members.isError && !forbidden ? (
        <div className="hstack">
          <span className="sub">{errorMessage(members.error)}</span>
          <button className="btn ghost" type="button" onClick={() => void members.refetch()}>Try again</button>
        </div>
      ) : null}
      {members.isSuccess && !rows.length ? <span className="sub">No members found.</span> : null}

      {rows.length ? (
        <TableWrap>
          <table>
            <thead><tr><th>Player</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {rows.map(member => {
                const captain = member.userId === data.leader.id
                return (
                  <tr key={member.userId}>
                    <td>
                      <span className="hstack">
                        <span className="avatar">{member.fullName.slice(0, 1)}</span>
                        {/* กดชื่อเพื่อเปิดโปรไฟล์สาธารณะ (GET /users/:id) */}
                        <button className="tchip link" type="button"
                          onClick={() => navigate(`/player/${member.userId}`)}>{member.fullName}</button>
                        {captain ? <span className="tag"> · captain</span> : null}
                      </span>
                    </td>
                    {/* ช่องตัวจริง/ตัวสำรองหายไปพร้อม migration 019 — ทีมเป็นคลังผู้เล่น
                        ใครลงแข่งเลือกตอนสมัครแต่ละทัวร์แทน (application_players) */}
                    <td className="sub">{new Date(member.joinedAt).toLocaleDateString()}</td>
                    <td>
                      <span className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        {isLeader && !captain && USE_MOCK ? (
                          <button className="btn ghost" type="button" disabled={transfer.isPending}
                            onClick={() => { transfer.reset(); setNotice(null); setHanding(member) }}>
                            Hand over
                          </button>
                        ) : null}
                        {isLeader && !captain ? (
                          <button className="btn ghost" type="button" disabled={!!lockName || kick.isPending}
                            title={lockName ? `Locked while ${lockName} is under way` : undefined}
                            onClick={() => { kick.reset(); setNotice(null); setRemoving(member) }}>
                            {kick.isPending && kick.variables === member.userId ? 'Removing…' : 'Remove'}
                          </button>
                        ) : null}
                        <button className="btn ghost" type="button" onClick={() => navigate(`/player/${member.userId}`)}>
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

      {/* backend ยังไม่มี POST /teams/:id/transfer-leader — บอกตรงๆ ไม่ทำปุ่มหลอก */}
      {isLeader && !USE_MOCK ? (
        <span className="sub">Handing over the captaincy isn't available yet — the backend has no endpoint for it.</span>
      ) : null}

      <Modal open={!!removing} onClose={() => setRemoving(null)} label="Remove a player"
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

      <Modal open={!!handing} onClose={() => setHanding(null)} label="Hand over the captaincy"
        title={handing ? `Make ${handing.fullName} the captain?` : ''}>
        <ConfirmCard ok="Hand over" onCancel={() => setHanding(null)}
          body={handing ? `${handing.fullName} becomes the team leader. You stay in the squad, but only the new leader can manage it.` : ''}
          onConfirm={() => {
            if (!handing) return
            const target = handing
            setHanding(null)
            transfer.mutate({ targetUserId: target.userId }, {
              onSuccess: () => setNotice({ kind: 'ok', text: `${target.fullName} is now the captain of ${data.name}.` }),
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
    <Panel quiet>
      <span className="tag"><em>//</em> Add players</span>
      <div className="sub">
        Adding a player sends an invitation — they join once they accept. Anyone joining before a
        tournament starts still has to clear the entry rules of the tournaments this squad is already in.
      </div>

      {lockName ? (
        <Banner kind="warn">
          <b>Adding players is locked.</b> {data.name} is playing {lockName}; invitations reopen when it names a champion.
        </Banner>
      ) : (
        <>
          <input value={search} placeholder="Search by name or email" aria-label="Search users to invite" autoComplete="off"
            onChange={e => { setSearch(e.target.value); invite.reset(); setNotice(null) }} />
          {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}
          {invite.isError ? <Banner kind="crit"><b>Couldn't send the invitation.</b> {errorMessage(invite.error)}</Banner> : null}
          {!typed ? <span className="sub">Type at least three letters.</span> : null}
          {typed && users.isPending ? <span className="sub">Searching users…</span> : null}
          {typed && users.isError ? <span className="sub">{errorMessage(users.error)}</span> : null}
          {typed && users.isSuccess && !results.length ? <span className="sub">Nobody left to invite matches that.</span> : null}
          {results.length ? (
            <TableWrap>
              <table>
                <tbody>
                  {results.map(person => (
                    <tr key={person.id}>
                      <td><span className="hstack"><span className="avatar">{person.fullName.slice(0, 1)}</span>{person.fullName}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn primary" type="button" disabled={invite.isPending}
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

      <span className="tag" style={{ marginTop: 6 }}><em>//</em> Sent invitations</span>
      {cancel.isError ? <Banner kind="crit"><b>Couldn't cancel the invitation.</b> {errorMessage(cancel.error)}</Banner> : null}
      {invitations.isPending ? <span className="sub">Loading sent invitations…</span> : null}
      {invitations.isError ? <span className="sub">{errorMessage(invitations.error)}</span> : null}
      {invitations.isSuccess && !sent.length ? <span className="sub">No invitations sent yet.</span> : null}
      {sent.length ? (
        <TableWrap>
          <table>
            <thead><tr><th>Invited</th><th>Status</th><th /></tr></thead>
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
                        onClick={() => cancel.mutate(invitation.id)}>
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
