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
 * ⚠️ กล่อง "คำเชิญเป็นกรรมการ" ยังใช้ store อยู่ — `refInvites` กับ
 *    `answerAppointment` เป็นโดเมนของสไลซ์ 4 (Referee management) ตาม PLAN.md
 *    ไม่ใช่ของเรา จะย้ายพร้อมกันตอนสไลซ์ 4 migrate ไม่ใช่ตอนนี้
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Empty, Panel, MatchStateBadge, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Modal } from '../../components/kit/Modal'
import { TeamChipView, TeamLinkView } from '../../components/kit/chips'
import { useMyMatches } from '../../hooks/useMatch'
import { answerAppointment, useLtms } from '../../shared/store'
import { me, tour, user } from '../../shared/selectors'
import { fmtDate } from '../../shared/rules'
import {
  REF_BUCKETS, isOpen, matchStateOf, refBucketOf, scoreText, toTeamView,
  type RefBucket,
} from '../match/matchView'
import type { MatchListItemDto } from '../../types/match.dto'

function MatchCard({ m, onPick }: { m: MatchListItemDto; onPick: () => void }) {
  return (
    <button type="button" className="panel quiet capsule vstack refcard" onClick={onPick}
      style={{ gap: 10, textAlign: 'left', width: '100%', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
      <div className="spread">
        <span className="tag"><em>//</em> {m.tournament.name}</span>
        <MatchStateBadge state={matchStateOf(m)} />
      </div>
      <div className="hstack" style={{ gap: 9 }}>
        <TeamChipView team={toTeamView(m.teamA)} />
        <span className="tag">vs</span>
        <TeamChipView team={toTeamView(m.teamB)} />
      </div>
      <div className="statline">
        <div>
          <span className="tag">Kick-off</span>
          <span className="v" style={{ fontSize: 16, fontFamily: 'var(--f-mono)' }}>
            {m.scheduledTime ? fmtDate(m.scheduledTime) : 'Not scheduled'}
          </span>
        </div>
        <div>
          <span className="tag">Venue</span>
          {/* TODO(schema): `matches` เก็บแค่ชื่อสนาม ไม่มีพิกัด — ลิงก์แผนที่ทำไม่ได้
              จนกว่าจะมีคอลัมน์ หรือ join พิกัดของทัวร์นาเมนต์มาให้ */}
          <span className="v" style={{ fontSize: 16, fontFamily: 'var(--f-ui)' }}>{m.venue || '—'}</span>
        </div>
        <div>
          <span className="tag">Checked in</span>
          <span className="v" style={{ fontSize: 16, fontFamily: 'var(--f-mono)' }}>
            {m.checkedIn} / {m.lineupSize}
          </span>
        </div>
      </div>
    </button>
  )
}

function MatchTable({ list }: { list: MatchListItemDto[] }) {
  const navigate = useNavigate()
  return (
    <TableWrap>
      <table>
        <thead>
          <tr><th>Kick-off</th><th>Tournament</th><th>Home</th><th /><th>Away</th><th>Score</th><th>State</th><th /></tr>
        </thead>
        <tbody>
          {list.map(m => (
            <tr key={m.id}>
              <td className="num">{m.scheduledTime ? fmtDate(m.scheduledTime) : '—'}</td>
              <td className="sub">{m.tournament.name}</td>
              <td><TeamLinkView team={toTeamView(m.teamA)} /></td>
              <td className="tag">vs</td>
              <td><TeamLinkView team={toTeamView(m.teamB)} /></td>
              <td className="num">{scoreText(m)}</td>
              <td><MatchStateBadge state={matchStateOf(m)} /></td>
              <td><button className="btn primary" type="button" onClick={() => navigate(`/m/${m.id}`)}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

/** A card summary opening straight into a short menu of what to do next. */
function RefQuickCard({ m, onClose }: { m: MatchListItemDto; onClose: () => void }) {
  const navigate = useNavigate()
  const bucket = refBucketOf(m)
  const primary = bucket === 'score' ? 'Enter the score' : bucket === 'confirm' ? 'Confirm the result' : 'Open the match'
  const blurb = bucket === 'score' ? "Both sides are due on court — record the result once it's in."
    : bucket === 'confirm' ? 'The winning squad already submitted online — confirm it to close this out.'
      : 'Nothing for you to do yet — waiting on the squads.'
  const go = (href: string) => { onClose(); navigate(href) }
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
        {m.mode === 'onsite' ? (
          <button className="who" type="button" onClick={() => go(`/checkin/${m.id}`)}>
            <span className="meta"><b>Check-in console</b><span className="tag">{m.checkedIn} checked in</span></span>
            <Icon name="chev" size={13} />
          </button>
        ) : null}
      </div>
      <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
    </>
  )
}

/**
 * คำเชิญเป็นกรรมการ — โดเมนของสไลซ์ 4 ที่มาแสดงบนหน้าของเรา
 * ยังอ่านจาก store ตรงๆ จนกว่าสไลซ์ 4 จะย้าย แล้วค่อยเปลี่ยนเป็น component ของเขา
 * ที่หน้านี้แค่ render เหมือนที่ MatchPage render <SocialBar/> ของสไลซ์ 1
 */
function RefereeInvites() {
  const s = useLtms()
  const u = me(s)
  const invites = u ? s.refInvites.filter(i => i.user === u.id && i.status === 'pending') : []
  if (!invites.length) return null
  return (
    <Panel>
      <span className="tag"><em>//</em> Appointments waiting on your answer</span>
      {invites.map(i => {
        const tr = tour(s, i.tour)
        if (!tr) return null
        return (
          <div className="vstack" style={{ gap: 9 }} key={i.id}>
            <div className="hstack">
              <b>{tr.name}</b>
              <Badge kind="neutral">{tr.channel}</Badge>
              <span className="sub">{user(s, tr.organizer)?.name} invited you · {tr.venue} · {tr.date}</span>
            </div>
            <div className="sub">
              Officiating is not a role and not a permission — accepting makes you eligible for this
              tournament only, and the organizer still assigns you match by match.
            </div>
            <div className="hstack">
              <button className="btn" type="button" onClick={() => answerAppointment(i.id, false)}>Decline</button>
              <button className="btn primary" type="button" onClick={() => answerAppointment(i.id, true)}>Accept appointment</button>
            </div>
          </div>
        )
      })}
    </Panel>
  )
}

export function MatchesPage() {
  const [quick, setQuick] = useState<MatchListItemDto | null>(null)
  const { data, isPending, isError, error, refetch } = useMyMatches()

  if (isPending) {
    return (
      <>
        <h1 className="disp" style={{ fontSize: 32 }}>Matches</h1>
        <Panel quiet><span className="sub">Loading your fixture list…</span></Panel>
      </>
    )
  }

  if (isError) {
    return (
      <>
        <h1 className="disp" style={{ fontSize: 32 }}>Matches</h1>
        <Banner kind="crit">
          <b>Could not load your matches.</b>{' '}
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Banner>
        <div className="hstack">
          <button className="btn primary" type="button" onClick={() => refetch()}>Try again</button>
        </div>
      </>
    )
  }

  const all = data.items
  const asRef = all.filter(m => m.viewer.roles.includes('referee'))
  const asPlayer = all.filter(m => m.viewer.roles.includes('player'))
  const asOrg = all.filter(m => m.viewer.roles.includes('organizer'))
  const orgDisputes = asOrg.filter(m => matchStateOf(m) === 'disputed')
  const refOpen = asRef.filter(isOpen)

  const grouped: Record<RefBucket, MatchListItemDto[]> = { score: [], confirm: [], waiting: [] }
  refOpen.forEach(m => { grouped[refBucketOf(m)].push(m) })

  return (
    <>
      <h1 className="disp" style={{ fontSize: 32 }}>Matches</h1>

      <RefereeInvites />

      {orgDisputes.length ? (
        <>
          <Banner kind="crit">
            <b>
              {orgDisputes.length === 1
                ? '1 dispute needs your decision.'
                : `${orgDisputes.length} disputes need your decision.`}
            </b>
          </Banner>
          <MatchTable list={orgDisputes} />
        </>
      ) : null}

      {refOpen.length ? (
        <>
          <span className="tag"><em>//</em> You are officiating — waiting on you · {refOpen.length}</span>
          <div className="refgrid">
            {(Object.keys(REF_BUCKETS) as RefBucket[]).map(k => (
              <div className="vstack" style={{ gap: 12 }} key={k}>
                <span className="tag"><em>//</em> {REF_BUCKETS[k].label} · {grouped[k].length}</span>
                {grouped[k].length
                  ? (
                    <div className="vstack" style={{ gap: 12 }}>
                      {grouped[k].map(m => <MatchCard key={m.id} m={m} onPick={() => setQuick(m)} />)}
                    </div>
                  )
                  : <span className="refempty">{REF_BUCKETS[k].empty}</span>}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {asRef.length ? (<><span className="tag"><em>//</em> You are officiating — every match · {asRef.length}</span><MatchTable list={asRef} /></>) : null}
      {asPlayer.length ? (<><span className="tag"><em>//</em> Your squad plays · {asPlayer.length}</span><MatchTable list={asPlayer} /></>) : null}
      {asOrg.length ? (<><span className="tag"><em>//</em> You run this tournament · {asOrg.length}</span><MatchTable list={asOrg} /></>) : null}

      {!asRef.length && !asPlayer.length && !asOrg.length ? (
        <Empty icon="match" title="Nothing on your fixture list"
          sub="Matches appear once a bracket you are part of is drawn." />
      ) : null}

      <Modal open={!!quick} onClose={() => setQuick(null)}>
        {quick ? <RefQuickCard m={quick} onClose={() => setQuick(null)} /> : null}
      </Modal>
    </>
  )
}
