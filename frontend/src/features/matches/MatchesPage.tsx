/**
 * src/features/matches/MatchesPage.tsx
 *
 * One person wears several hats at once — officiating one tournament, playing in
 * another, running a third. Merging them into one fixture list loses the only
 * thing that matters here: what is being asked of you, and by which role.
 *
 * A referee's open matches are never one queue either: on-site and online swap
 * who moves next, so "waiting on you" means three different things.
 *
 * ── หน้าแรกของสไลซ์ 3 ที่ย้ายมาใช้ API แล้ว (PLAN.md ขั้นที่ 2) ─────────────
 * ข้อมูลแมตช์มาจาก `useMyMatches()` ไม่ใช่ `useLtms()` — ซึ่งแปลว่าหน้านี้เป็น
 * หน้าแรกในแอปที่เป็น async จริง จึงมี loading/error state ที่เดิมไม่เคยต้องมี
 *
 * `viewer.roles` มาจาก server: มันรู้อยู่แล้วว่าเราเกี่ยวข้องกับแมตช์นี้ในฐานะอะไร
 * ดีกว่าให้ frontend เดาเอาจาก roster ซึ่งต้องโหลดทีมทุกทีมมาไล่ดู
 *
 * กล่อง "คำเชิญเป็นกรรมการ" อ่านจาก GET /me/referee-invitations อย่างเดียว
 * (route มีใน backend แล้ว จึงไม่มี fallback จาก store)
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { RefereeConflictLink } from '../match/RefereeConflictLink'
import { Badge, Banner, Empty, Panel, MatchStateBadge, TableWrap } from '../../components/kit/primitives'
import { matchTime } from '../match/matchTime'
import { Icon } from '../../components/kit/Icon'
import { Modal } from '../../components/kit/Modal'
import { TeamChipView, TeamLinkView } from '../../components/kit/chips'
import { useMyMatches } from '../../hooks/useMatch'
import {
  useMyRefereeInvitations, useAcceptRefereeInvitation, useDeclineRefereeInvitation,
} from '../../hooks/useAdmin'
import { fmtDate } from '../../shared/rules'
import {
  REF_BUCKETS, isOpen, matchStateOf, refBucketOf, scoreText, toTeamView,
  type RefBucket,
} from '../match/matchView'
import type { MatchListItemDto } from '../../types/match.dto'
import type { MyRefereeInvitationDto } from '../../types/admin.dto'

const REF_QUEUE_COPY: Record<RefBucket, { label: string; hint: string; empty: string }> = {
  room: { label: 'Rooms', hint: 'Open the match to review its room and check-ins.', empty: 'No room setup tasks in this view.' },
  score: { label: 'Scores', hint: 'Open scheduled matches. Record results after play finishes.', empty: 'No score tasks in this view.' },
  confirm: { label: 'Confirmation', hint: 'Review the submitted result before confirming it.', empty: 'No results waiting for confirmation in this view.' },
  waiting: { label: 'Waiting', hint: 'Open a match to review its current state and available actions.', empty: 'No waiting tasks in this view.' },
}

function useOpenMatch(matchListBucket?: RefBucket) {
  const navigate = useNavigate()
  const location = useLocation()
  return (href: string) => {
    const matchListHref = location.pathname + location.search
    const matchListScroll = window.scrollY
    const matchListRegions = Object.fromEntries([...document.querySelectorAll<HTMLElement>('.match-list-groups-scroll, .match-bucket-scroll')]
      .map(region => [region.getAttribute('aria-label') ?? '', region.scrollTop]))
    const state = { ...location.state, matchListScroll, matchListRegions, ...(matchListBucket ? { matchListBucket } : {}) }
    navigate(matchListHref, { replace: true, state })
    navigate(href, { state: { ...state, matchListHref } })
  }
}

function MatchCard({ m, onPick, onOpen }: { m: MatchListItemDto; onPick: () => void; onOpen: () => void }) {
  const bucket = refBucketOf(m)
  const action = bucket === 'room' ? 'Open room' : bucket === 'confirm' ? 'Confirm result'
    : bucket === 'score' && m.status === 'finished' ? 'Record result' : 'Open match'
  const contextIds = `ref-match-${m.id}-teams ref-match-${m.id}-context`
  return (
    <article className="panel quiet vstack refcard" aria-labelledby={contextIds}>
      <h3 id={`ref-match-${m.id}-teams`} className="refcard-teams">
        <TeamChipView team={toTeamView(m.teamA)} />
        {' '}<span className="refcard-versus">vs</span>{' '}
        <TeamChipView team={toTeamView(m.teamB)} />
      </h3>
      <div className="refcard-context">
        <p id={`ref-match-${m.id}-context`}>
          <span>{m.tournament.name}</span> <span>{m.tag || m.stage}</span>
        </p>
        <MatchStateBadge state={matchStateOf(m)} />
        {m.conflictingMatchIds?.length ? <Badge kind="crit">Time conflict</Badge> : null}
      </div>
      <dl className="refcard-metadata">
        <div>
          <dt>Kick-off</dt>
          <dd>
            {m.scheduledTime ? matchTime(m.scheduledTime) : 'Not scheduled'}
          </dd>
        </div>
        <div>
          <dt>Venue</dt>
          {/* TODO(schema): `matches` เก็บแค่ชื่อสนาม ไม่มีพิกัด — ลิงก์แผนที่ทำไม่ได้
              จนกว่าจะมีคอลัมน์ หรือ join พิกัดของทัวร์นาเมนต์มาให้ */}
          <dd>{m.venue || 'Not set'}</dd>
        </div>
        <div>
          <dt>Checked in</dt>
          {/* ยอดเช็คอินอ่านได้เฉพาะผู้จัดกับกรรมการ — ผู้เล่นไม่รู้ทั้งตัวตั้งและตัวหาร
              เขียน "0 / 0" ให้เขาอ่านก็เท่ากับบอกว่ายังไม่มีใครมา */}
          <dd>
            {m.lineupSize ? `${m.checkedIn} / ${m.lineupSize}` : '—'}
          </dd>
        </div>
      </dl>
      <div className="refcard-actions">
        <button className="btn ghost" type="button" aria-describedby={contextIds} onClick={onPick}>Match details</button>
        <button className="btn primary" type="button" aria-describedby={contextIds} onClick={onOpen}>{action}</button>
      </div>
    </article>
  )
}

function MatchTable({ list, label = 'Matches' }: { list: MatchListItemDto[]; label?: string }) {
  const openMatch = useOpenMatch()
  return (
    <TableWrap label={label}>
      <table>
        <thead>
          <tr><th>Kick-off</th><th>Tournament</th><th>Home</th><th aria-label="Versus" /><th>Away</th><th>Score</th><th>State</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {list.map(m => (
            <tr key={m.id}>
              <td className="num">{m.scheduledTime ? matchTime(m.scheduledTime) : 'Not scheduled'}</td>
              <td className="sub">{m.tournament.name}</td>
              <td><TeamLinkView team={toTeamView(m.teamA)} /></td>
              <td className="tag">vs</td>
              <td><TeamLinkView team={toTeamView(m.teamB)} /></td>
              <td className="num">{scoreText(m)}</td>
              <td><MatchStateBadge state={matchStateOf(m)} />{m.conflictingMatchIds?.length ? <> <Badge kind="crit">Time conflict</Badge></> : null}</td>
              <td><button className="btn primary" type="button" onClick={() => openMatch(`/m/${m.id}`)}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

/** A card summary opening straight into a short menu of what to do next. */
function RefQuickCard({ m, onClose, selectedBucket }: { m: MatchListItemDto; onClose: () => void; selectedBucket: RefBucket }) {
  const openMatch = useOpenMatch(selectedBucket)
  const bucket = refBucketOf(m)
  const primary = bucket === 'room' ? 'Open the room'
    : bucket === 'score' ? 'Enter the score'
      : bucket === 'confirm' ? 'Confirm the result' : 'Open the match'
  const blurb = bucket === 'room' ? 'Review the online room and player check-ins.'
    : bucket === 'score' ? 'Result entry opens after play finishes.'
      : bucket === 'confirm' ? 'Review the submitted result and your available actions.'
        : 'Open the match to see the current state.'
  const go = (href: string) => { onClose(); openMatch(href) }
  return (
    <>
      <div className="spread">
        <span className="tag"><em>//</em> {m.tournament.name}</span>
        <MatchStateBadge state={matchStateOf(m)} />
      </div>
      <div className="hstack" style={{ gap: 9 }}>
        <TeamChipView team={toTeamView(m.teamA)} />
        <span className="tag">vs</span>
        <TeamChipView team={toTeamView(m.teamB)} />
      </div>
      <span className="sub">{blurb}</span>
      <div className="vstack" style={{ gap: 8 }}>
        <button className="who" type="button" onClick={() => go(`/m/${m.id}`)}>
          <span className="meta"><b>{primary}</b><span className="tag">Match page</span></span><Icon name="chev" size={13} />
        </button>
        {/* online ก็ต้องเข้าคอนโซลได้ — เป็นที่เดียวที่ประกาศรหัสห้องได้ */}
        <button className="who" type="button" onClick={() => go(`/checkin/${m.id}`)}>
          <span className="meta">
            <b>{m.mode === 'online' ? 'Room & check-in' : 'Check-in console'}</b>
            <span className="tag">
              {m.mode === 'online' && !m.roomCode ? 'no room yet' : `${m.checkedIn} checked in`}
            </span>
          </span>
          <Icon name="chev" size={13} />
        </button>
      </div>
      <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
    </>
  )
}

/**
 * คำเชิญหนึ่งใบ — ตอบผ่าน POST /referee-invitations/:id/accept | /decline
 * (decline ตอบ 204 ไม่มี body) · ผลลัพธ์ส่งกลับให้ผู้เรียกแสดง เพราะพอตอบแล้วแถวนี้
 * หายจากรายการทันทีหลัง invalidate ข้อความสำเร็จจึงอยู่ในแถวไม่ได้
 */
function AppointmentRow({ invite, onDone }: {
  invite: MyRefereeInvitationDto
  onDone: (notice: { kind: 'ok' | 'warn'; text: string }) => void
}) {
  const accept = useAcceptRefereeInvitation()
  const decline = useDeclineRefereeInvitation()
  const pending = accept.isPending || decline.isPending
  const failed = accept.error ?? decline.error

  return (
    <>
      {failed ? (
        <Banner kind="crit">
          <b>ตอบคำเชิญไม่สำเร็จ</b>{' '}
          {/* migration 036 — ฐานห้ามกรรมการคนเดิมมีสองแถวที่ใช้งานได้ในทัวร์เดียว · เกิดเมื่อคำเชิญสองใบ
              หลุดด่านพร้อมกัน เดิมเป็น 500 ดิบ ตอนนี้ 409 — บอกทางออกให้ด้วย ไม่ใช่แค่ว่าพัง */}
          {(failed as { code?: string }).code === 'REFEREE_ALREADY_ACTIVE'
            ? 'You are already an active referee of this tournament, so this extra invitation is not needed — decline it to clear it.'
            : (failed as Error).message}
          <RefereeConflictLink error={failed} />
        </Banner>
      ) : null}
      <div className="hstack">
        <button className="btn" type="button" disabled={pending}
          onClick={() => decline.mutate(invite.id, {
            onSuccess: () => onDone({ kind: 'warn', text: `Declined the appointment for ${invite.tournament.name}.` }),
          })}>
          {decline.isPending ? 'Declining…' : 'Decline'}
        </button>
        <button className="btn primary" type="button" disabled={pending}
          onClick={() => accept.mutate(invite.id, {
            onSuccess: res => onDone({
              kind: 'ok',
              text: res?.requiresAdminApproval
                ? `Accepted — an admin still has to approve you as an external referee for ${invite.tournament.name}.`
                : `Accepted — you can now officiate ${invite.tournament.name}.`,
            }),
          })}>
          {accept.isPending ? 'Accepting…' : 'Accept appointment'}
        </button>
      </div>
    </>
  )
}

/**
 * คำเชิญเป็นกรรมการของฉัน — GET /me/referee-invitations
 *
 * route นี้มีใน backend แล้ว จึงไม่ถอยไปอ่าน store (โหมด mock ตัว API อ่าน store ให้เอง)
 * 401/403 เป็นเรื่องสิทธิ์ ไม่ใช่ "ไม่มีคำเชิญ" · ถ้าไม่มีคำเชิญเลยจะไม่แสดงกล่อง เพราะ
 * หน้านี้เปิดโดยทุกคน กล่องว่างจะรกหน้าคนที่ไม่เคยถูกเชิญ
 */
function RefereeInvites() {
  const { data, isPending, isError, error, refetch } = useMyRefereeInvitations()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)
  const invites = data?.items ?? []
  const status = (error as { status?: number } | null)?.status

  if (isPending) return <div className="sub">Checking for referee appointments…</div>

  if (isError) {
    return status === 401 || status === 403 ? (
      <Banner kind="warn">
        <b>Referee appointments aren't available to this account.</b>{' '}
        {status === 401 ? 'Sign in again to see them.' : 'Your account does not have access to them.'}
      </Banner>
    ) : (
      <Banner kind="crit">
        <span className="grow"><b>Couldn't load your referee appointments.</b> {(error as Error).message}</span>
        <button className="btn" type="button" onClick={() => void refetch()}>Try again</button>
      </Banner>
    )
  }

  if (!invites.length && !notice) return null

  return (
    <Panel>
      <span className="tag"><em>//</em> Appointments waiting on your answer · {invites.length}</span>
      {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}
      {invites.map(inv => (
        <div className="vstack" style={{ gap: 9 }} key={inv.id}>
          <div className="hstack">
            <b>{inv.tournament.name}</b>
            {inv.isExternal
              ? <Badge kind="warn">External — needs admin approval</Badge>
              : <Badge kind="neutral">Referee</Badge>}
            <span className="sub">Event {fmtDate(inv.tournament.eventStartDate || inv.createdAt)} · invited {fmtDate(inv.createdAt)}</span>
          </div>
          <div className="sub">
            Officiating is not a role and not a permission — accepting makes you eligible for this
            tournament only, and the organizer still assigns you match by match.
          </div>
          <AppointmentRow invite={inv} onDone={setNotice} />
        </div>
      ))}
      {!invites.length ? <span className="sub">No appointments left to answer.</span> : null}
    </Panel>
  )
}

function GroupedMatches({ list, title }: { list: MatchListItemDto[]; title: string }) {
  const groups = new Map<string, MatchListItemDto[]>()
  for (const match of list) {
    const key = `${match.tournament.id}:${match.stage}`
    groups.set(key, [...(groups.get(key) ?? []), match])
  }
  return <section className="match-list-section" aria-label={title}>
    <h2>{title} <span className="sub">{list.length}</span></h2>
    <div className="match-list-groups-scroll" role="region" aria-label={`${title} matches`} tabIndex={0}>
    {[...groups.entries()].map(([key, rows]) => <div className="match-list-group" key={key}>
      <h3>{rows[0].tournament.name} <span className="sub">{rows[0].stage}</span></h3>
      <MatchTable list={rows} label={`${title}: ${rows[0].tournament.name}, ${rows[0].stage}`} />
    </div>)}
    </div>
  </section>
}

export function MatchesPage() {
  const [quick, setQuick] = useState<MatchListItemDto | null>(null)
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [chosenBucket, setChosenBucket] = useState<RefBucket | null>(() => {
    const saved = location.state?.matchListBucket
    return Object.keys(REF_BUCKETS).includes(saved) ? saved : null
  })
  const search = params.get('q') ?? ''
  const selectedState = params.get('state') ?? ''
  const { data, isPending, isError, error, refetch } = useMyMatches()
  const status = (error as { status?: number } | null)?.status
  const denied = isError && [401, 403, 404].includes(status ?? 0)
  useEffect(() => {
    const position = location.state?.matchListScroll
    if (typeof position === 'number') window.scrollTo({ top: position, behavior: 'instant' })
    const regions = location.state?.matchListRegions
    if (regions) for (const region of document.querySelectorAll<HTMLElement>('.match-list-groups-scroll, .match-bucket-scroll')) {
      const top = regions[region.getAttribute('aria-label') ?? '']
      if (typeof top === 'number') region.scrollTop = top
    }
  }, [location.key, location.state, data])
  const filter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  const all = denied ? [] : data?.items ?? []
  const needle = search.trim().toLocaleLowerCase()
  const visible = all.filter(m => (!needle || [m.tournament.name, m.stage, m.tag, m.teamA?.name, m.teamB?.name, m.venue]
    .some(value => value?.toLocaleLowerCase().includes(needle))) && (!selectedState || matchStateOf(m) === selectedState))
  const asRef = visible.filter(m => m.viewer.roles.includes('referee'))
  const asPlayer = visible.filter(m => m.viewer.roles.includes('player'))
  const asOrg = visible.filter(m => m.viewer.roles.includes('organizer'))
  const orgDisputes = asOrg.filter(m => matchStateOf(m) === 'disputed')
  const refOpen = asRef.filter(isOpen)
  const grouped: Record<RefBucket, MatchListItemDto[]> = { room: [], score: [], confirm: [], waiting: [] }
  refOpen.forEach(m => { grouped[refBucketOf(m)].push(m) })
  const selectedBucket = chosenBucket ?? (Object.keys(REF_BUCKETS) as RefBucket[]).find(k => grouped[k].length) ?? 'score'
  const openMatch = useOpenMatch(selectedBucket)
  const currentQuick = quick && !denied ? all.find(m => m.id === quick.id) : null

  return <div className="matches-page">
    <h1 className="disp">Matches</h1>
    {isError ? <Banner kind="crit">
      <b>Could not load your matches.</b> {error instanceof Error ? error.message : 'Try refreshing the list.'}
      <button className="btn" type="button" onClick={() => void refetch()}>Try again</button>
    </Banner> : null}
    {denied || (isError && !data) ? null : isPending && !data
      ? <Panel quiet>Loading your fixture list…</Panel>
      : <>
        <div className="match-list-toolbar">
          <label className="field">Search<input type="search" aria-label="Search matches" placeholder="Team, tournament or round" value={search}
            onChange={e => filter('q', e.target.value)} /></label>
          <label className="field">Status<select aria-label="Match status" value={selectedState} onChange={e => filter('state', e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries({ waiting: 'Waiting for teams', scheduled: 'Scheduled', checkin: 'Check-in open', live: 'In progress', finished: 'Finished', pending: 'Awaiting confirmation', confirmed: 'Confirmed', disputed: 'Disputed', rejected: 'Result rejected' })
              .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <span className="sub" role="status">{visible.length} of {all.length} matches</span>
          {search || selectedState ? <button className="btn ghost" type="button" onClick={() => {
            const next = new URLSearchParams(params); next.delete('q'); next.delete('state'); setParams(next, { replace: true })
          }}>Clear filters</button> : null}
        </div>
        <RefereeInvites />
      {all.filter(m => m.conflictingMatchIds?.length).map(m => (
        <Panel quiet key={`conflict:${m.id}`}>
          <Banner kind="warn"><b>Time conflict — {m.tournament.name}</b></Banner>
          <p><Link to={`/m/${m.id}`}>Match #{m.id}</Link> · {m.viewer.roles.filter(role => role !== 'organizer').join(' / ')} · {m.scheduledTime ? fmtDate(m.scheduledTime) : 'Not scheduled'} – {m.scheduledEndTime ? fmtDate(m.scheduledEndTime) : 'End time not set'}</p>
          <ul>{m.conflictingMatchIds!.map(id => {
            const other = all.find(row => row.id === id)
            return <li key={id}><Link to={`/m/${id}`}>{other?.tournament.name ?? `Match #${id}`} · Match #{id}</Link>{other ? <> · {other.viewer.roles.filter(role => role !== 'organizer').join(' / ')} · {other.scheduledTime ? fmtDate(other.scheduledTime) : 'Not scheduled'} – {other.scheduledEndTime ? fmtDate(other.scheduledEndTime) : 'End time not set'}</> : null}</li>
          })}</ul>
          <p className="sub">You cannot attend both at the same time. Players: contact your team captain. Referees: open the match to request withdrawal; the organizer must approve it first.</p>
        </Panel>
      ))}
      {all.some(m => m.conflictingMatchIds !== undefined && (!m.scheduledTime || !m.scheduledEndTime)) ? <Banner kind="warn">Some matches have no start or end time. Time conflicts cannot be checked for those matches yet.</Banner> : null}


        {orgDisputes.length ? <GroupedMatches title="Disputes to review" list={orgDisputes} /> : null}
        {refOpen.length ? <section className="match-list-section referee-work" aria-label="Referee work">
          <div className="referee-work-heading">
            <h2 className="disp">Referee work</h2>
            <span className="sub">{refOpen.length} open matches in this view</span>
          </div>
          <div className="match-work-categories" role="group" aria-label="Referee work categories">
            {(Object.keys(REF_BUCKETS) as RefBucket[]).map(k => <button className="match-work-category" type="button" key={k}
              aria-pressed={selectedBucket === k} onClick={() => setChosenBucket(k)}>
              {REF_QUEUE_COPY[k].label} <span>{grouped[k].length}</span>
            </button>)}
          </div>
          <div className="match-work-bucket" key={selectedBucket}>
            <p className="sub" id="referee-work-hint">{REF_QUEUE_COPY[selectedBucket].hint}</p>
            <div className="match-bucket-scroll" role="region" aria-label={REF_BUCKETS[selectedBucket].label} aria-describedby="referee-work-hint" tabIndex={0}>
              {grouped[selectedBucket].length ? grouped[selectedBucket].map(m => <MatchCard key={m.id} m={m}
                onPick={() => setQuick(m)} onOpen={() => openMatch(`/m/${m.id}`)} />)
                : <span className="sub">{REF_QUEUE_COPY[selectedBucket].empty}</span>}
            </div>
            {grouped[selectedBucket].length > 2 ? <p className="sub">Scroll this queue for all {grouped[selectedBucket].length} tasks. Use Tab to reach each match action.</p> : null}
          </div>
        </section> : null}
        {asRef.length ? <GroupedMatches title="You referee" list={asRef} /> : null}
        {asPlayer.length ? <GroupedMatches title="Your team" list={asPlayer} /> : null}
        {asOrg.length ? <GroupedMatches title="You organize" list={asOrg} /> : null}
        {!visible.length ? <Empty icon="match" title={all.length ? 'No matches found' : 'No matches yet'}
          sub={all.length ? 'Change or clear your filters.' : 'Your matches appear after the bracket is drawn.'} /> : null}
      </>}
    <Modal open={!!currentQuick} title="Match preview" onClose={() => setQuick(null)}>
      {currentQuick ? <RefQuickCard m={currentQuick} selectedBucket={selectedBucket} onClose={() => setQuick(null)} /> : null}
    </Modal>
  </div>
}
