/**
 * src/features/tournament/manage/RegistrationsPanel.tsx
 *
 * The Soft filter: the Organizer's review of a registration that already cleared
 * the Hard filter. Rejections by the Hard filter are listed too — as a record,
 * not a decision, because nobody here made it and nobody can undo it.
 *
 * ── ทำไมยังมีสองแหล่งข้อมูล ────────────────────────────────────────────────
 * ทัวร์นาเมนต์ที่ route id เป็นตัวเลขมาจาก API — ใบสมัครอ่านจาก
 * `useTournament(id).applications` และ mutation ใช้ `application.id` ได้ตรงๆ
 *
 * ทัวร์นาเมนต์ของ prototype ใช้ id เป็น string ('t-fut') — อ่านจาก store และ
 * สั่งงานได้เหมือนกัน เพราะชั้น API รับ ref ทั้งสองแบบแล้วเขียนกลับ store
 * (ดู mocks/tournamentWrites.ts) เดิมส่ง `Number('reg-3')` = NaN เข้า API เงียบๆ
 *
 * ทั้งสองทางถูกแปลงเป็น `RegRow` ชุดเดียวก่อนวาด JSX จึงมีเส้นทางแสดงผลเดียว
 */
import { Avatar } from '../../../components/kit/Avatar'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Field, Panel, TableWrap } from '../../../components/kit/primitives'
import { TeamCrestView } from '../../../components/kit/chips'
import { toTeamView } from '../../../components/kit/viewModels'
import { useManageActive } from './ManageActivity'
import { Modal } from '../../../components/kit/Modal'
import { useLtms } from '../../../shared/store'
import { useApplicationDetail, useApproveRegistration, useRejectRegistration, useTournamentApplications } from '../../../hooks/useTournament'
import { ApiError, USE_MOCK } from '../../../api/client'
import { reviewTournamentApplicationSchema, type ReviewTournamentApplicationInput } from '../../../schemas/tournament.schema'
import { regsOf, team, user } from '../../../shared/selectors'
import { fmtDate, hardFilter } from '../../../shared/rules'
import type { State, Tournament } from '../../../shared/types'
import type { BackendTournamentApplicationDto } from '../../../types/tournament.dto'

/**
 * ใบสมัครหนึ่งใบ ไม่ว่าจะมาจาก API หรือ store
 * `applicationId` เป็น null แปลว่าแถวนี้สั่งงานผ่าน API ไม่ได้
 */
interface RegRow {
  key: string
  applicationId: number | string | null
  /** id ของทีมในฝั่ง store — มีเฉพาะทางเดิม ใช้ผูก TeamLink และอวาตาร์ */
  teamStoreId: string | null
  teamName: string
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'cancelled'
  /** null = ยังไม่ได้ตรวจ · true = ผ่าน · false = ไม่ผ่าน */
  hardFilterPassed: boolean | null
  hardFilterFails: string[]
  reason: string | null
  withdrawRequested: boolean
  squad: string[]
  at: number | null
}

function rowsFromApi(apps: BackendTournamentApplicationDto[]): RegRow[] {
  return apps.map(a => ({
    key: `api-${a.id}`,
    applicationId: a.id,
    teamStoreId: null,
    teamName: a.team.name,
    status: a.status,
    hardFilterPassed: a.hardFilterPassed,
    hardFilterFails: [],
    reason: null,
    /* DTO ยังไม่มีคอลัมน์นี้ — ดูหมายเหตุใต้ตารางถอนตัว */
    withdrawRequested: false,
    squad: [],
    at: a.appliedAt ? Date.parse(a.appliedAt) : null,
  }))
}

function rowsFromStore(s: State, t: Tournament): RegRow[] {
  return regsOf(s, t.id).map(r => {
    const tm = team(s, r.team)
    const fails = tm ? hardFilter(s, tm, t, r.squad) : []
    return {
      key: `store-${r.id}`,
      applicationId: r.id,
      teamStoreId: r.team,
      teamName: tm?.name ?? '—',
      status: r.status as RegRow['status'],
      hardFilterPassed: tm ? fails.length === 0 : null,
      hardFilterFails: fails.map(f => `${f.user.name} — ${f.rule}`),
      reason: r.reason ?? null,
      withdrawRequested: !!r.withdrawRequested,
      squad: r.squad,
      at: r.at,
    }
  })
}

export function RegistrationsPanel({ t }: { t: Tournament }) {
  const active = useManageActive()
  const s = useLtms()
  const navigate = useNavigate()
  const [review, setReview] = useState<RegRow | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const reviewApplicationId = typeof review?.applicationId === 'number' ? review.applicationId : undefined
  const applicationDetail = useApplicationDetail(reviewApplicationId, active && !!review)
  const tournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  const applications = useTournamentApplications(tournamentId)
  const rows = !USE_MOCK ? rowsFromApi(applications.data?.items ?? []) : rowsFromStore(s, t)
  const pend = rows.filter(r => r.status === 'pending')
  const approved = rows.filter(r => r.status === 'approved')
  const filtered = rows.filter(r => r.teamName.toLowerCase().includes(search.trim().toLowerCase())
    && (status === 'all' || r.status === status))
  const apiId = tournamentId ?? t.id
  const approve = useApproveRegistration(apiId)
  const reject = useRejectRegistration(apiId)
  const { register, handleSubmit, setError, reset, formState: { errors } } =
    useForm<ReviewTournamentApplicationInput>({ resolver: zodResolver(reviewTournamentApplicationSchema) })
  const denied = (error: unknown) => error instanceof ApiError && [401, 403, 404].includes(error.status)
  const message = (error: unknown) => error instanceof Error ? error.message : 'Try again.'
  const busy = approve.isPending || reject.isPending
  const reviewCurrent = !!review && rows.some(r => r.key === review.key && r.status === 'pending')
  const reviewBlocked = !review || review.applicationId === null || busy || (!USE_MOCK && denied(applicationDetail.error))

  if (!USE_MOCK && !applications.data && applications.isPending) return <Panel><span className="sub">Loading registrations…</span></Panel>
  if (!USE_MOCK && applications.isError && (!applications.data || denied(applications.error))) return <Panel>
    <Banner kind="crit">Unable to load registrations. {message(applications.error)}</Banner>
    <button className="btn" type="button" onClick={() => void applications.refetch()}>Try again</button>
  </Panel>

  const startReview = (r: RegRow) => { reset(); approve.reset(); reject.reset(); setReview(r) }
  const rejectReview = handleSubmit(async input => {
    if (reviewBlocked || !review || review.applicationId === null) return
    try {
      await reject.mutateAsync({ applicationId: review.applicationId, rejectionReason: input.rejectionReason ?? '' })
      setReview(null); reset()
    } catch (error) {
      if (error instanceof ApiError && error.fields) Object.entries(error.fields).forEach(([field, text]) =>
        setError(field as keyof ReviewTournamentApplicationInput, { type: 'server', message: text }))
    }
  })

  return <>
    <Panel className="organizer-registrations">
      <div className="spread"><h2>Registrations</h2>
        <Badge kind={pend.length ? 'warn' : 'neutral'}>{`${approved.length} approved · ${pend.length} pending`}</Badge>
      </div>
      {!USE_MOCK && applications.isError ? <Banner kind="warn">
        Showing saved registrations. {message(applications.error)}{' '}
        <button className="btn ghost" type="button" onClick={() => void applications.refetch()}>Try again</button>
      </Banner> : null}
      <div className="organizer-filters">
        <Field label="Search teams" htmlFor="registration-search"><input id="registration-search" type="search"
          placeholder="Team name" value={search} onChange={e => setSearch(e.target.value)} /></Field>
        <Field label="Registration status" htmlFor="registration-status"><select id="registration-status" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {['pending', 'approved', 'rejected', 'withdrawn', 'cancelled'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
        </select></Field>
        {search || status !== 'all' ? <button className="btn ghost" type="button" onClick={() => { setSearch(''); setStatus('all') }}>Clear filters</button> : null}
      </div>
      <p className="sub" role="status">{filtered.length} of {rows.length} registrations</p>
      {approve.isError ? <Banner kind="crit">Couldn't approve the team. {message(approve.error)}</Banner> : null}
      {approve.isSuccess ? <Banner kind="ok">Team approved.</Banner> : null}
      {filtered.length ? <TableWrap label="Registration list"><table>
        <thead><tr><th>Team</th><th>Status</th><th>Hard filter</th><th>Applied</th><th>Action</th></tr></thead>
        <tbody>{filtered.map(r => {
          const tm = r.teamStoreId ? team(s, r.teamStoreId) : null
          return <tr key={r.key}>
            <td><span className="hstack"><TeamCrestView size={28} team={tm ? toTeamView(tm)
              : { id: r.teamStoreId ?? '', name: r.teamName, code: r.teamName.slice(0, 3).toUpperCase(), color: null, logoUrl: null }} /><b>{r.teamName}</b></span>
              {r.reason ? <p className="sub">{r.reason}</p> : null}</td>
            <td><Badge kind={r.status === 'approved' ? 'ok' : r.status === 'pending' ? 'warn' : r.status === 'rejected' ? 'crit' : 'neutral'}>{r.status}</Badge></td>
            <td><Badge kind={r.hardFilterPassed === false ? 'crit' : r.hardFilterPassed ? 'ok' : 'neutral'}>
              {r.hardFilterPassed === false ? 'Failed' : r.hardFilterPassed ? 'Passed' : 'Not checked'}</Badge></td>
            <td className="sub">{r.at ? fmtDate(r.at) : '—'}</td>
            <td>{r.status === 'pending' ? <div className="hstack">
              <button className="btn" type="button" onClick={() => startReview(r)}>Review</button>
              <button className="btn primary" type="button" disabled={r.applicationId === null || busy}
                onClick={() => { if (r.applicationId !== null) approve.mutate(r.applicationId) }}>{approve.isPending && approve.variables === r.applicationId ? 'Approving…' : 'Approve'}</button>
            </div> : tm ? <button className="btn ghost" type="button" onClick={() => navigate(`/team/${tm.id}`)}>View team</button> : '—'}</td>
          </tr>
        })}</tbody>
      </table></TableWrap> : <div className="empty"><b>{rows.length ? 'No matching registrations' : 'No registrations yet'}</b>
        <p className="sub">{rows.length ? 'Change or clear the filters.' : 'Applications appear here when teams enter.'}</p></div>}
    </Panel>

    <Modal className="organizer-review-dialog" open={active && reviewCurrent} onClose={() => { if (!busy) setReview(null) }} label="Review entry" title={review?.teamName}>
      <form id="registration-review" className="organizer-review-body" role="region" aria-label="Entry review details" tabIndex={0} onSubmit={rejectReview}>
        <section className="vstack"><h4>Team</h4>
          <p className="sub">Review this submitted entry before deciding. The hard filter is checked by the system.</p>
          <Badge kind={review?.hardFilterPassed === false ? 'crit' : review?.hardFilterPassed ? 'ok' : 'neutral'}>
            {review?.hardFilterPassed === false ? 'Hard filter failed' : review?.hardFilterPassed ? 'Hard filter passed' : 'Hard filter not checked'}</Badge>
          {review?.hardFilterFails.length ? <Banner kind="crit">{review.hardFilterFails.join('; ')}</Banner> : null}
        </section>
        <section className="vstack"><h4>Entry notes</h4><p className="organizer-notes">{t.entryNotes || 'No entry notes.'}</p></section>
        <section className="vstack organizer-review-players"><h4>Players</h4>
          {!USE_MOCK && applicationDetail.isPending ? <p className="sub">Loading submitted players…</p> : null}
          {!USE_MOCK && applicationDetail.isError ? <Banner kind="crit">Unable to load the submitted players. {message(applicationDetail.error)}{' '}
            <button className="btn ghost" type="button" onClick={() => void applicationDetail.refetch()}>Try again</button></Banner> : null}
          {!USE_MOCK && applicationDetail.data && !denied(applicationDetail.error) ? applicationDetail.data.players.length ?
            <TableWrap label="Submitted players"><table><thead><tr><th>Player</th></tr></thead><tbody>{applicationDetail.data.players.map(player =>
              <tr key={player.userId}><td><span className="hstack"><Avatar name={player.fullName} avatarUrl={player.avatarUrl} />{player.fullName}</span></td></tr>)}</tbody></table></TableWrap>
            : <p className="sub">This application no longer has a locked player list.</p> : null}
          {USE_MOCK && review?.squad.length ? <TableWrap label="Submitted players"><table><thead><tr><th>Player</th><th>Faculty</th><th>Year</th></tr></thead><tbody>
            {review.squad.map(id => { const p = user(s, id); return p ? <tr key={id}><td>{p.name}</td><td>{p.faculty}</td><td>{p.year}</td></tr> : null })}
          </tbody></table></TableWrap> : null}
        </section>
        <section className="vstack organizer-review-reason">
          <input type="hidden" value="rejected" {...register('status')} />
          <Field label="Reason" htmlFor="registration-reason"><textarea id="registration-reason" rows={3} placeholder="Required for rejection" {...register('rejectionReason')} />
            {errors.rejectionReason?.message ? <span className="sub">{errors.rejectionReason.message}</span> : null}</Field>
          {reject.isError ? <Banner kind="crit">Couldn't reject the team. {message(reject.error)}</Banner> : null}
          {approve.isError ? <Banner kind="crit">Couldn't approve the team. {message(approve.error)}</Banner> : null}
        </section>
      </form>
      <div className="organizer-review-footer">
        <p className="sub">{busy ? 'Saving decision…' : 'Decision applies to this team only.'}</p>
        <div className="hstack">
          <button className="btn" type="button" disabled={busy} onClick={() => setReview(null)}>Cancel</button>
          <button className="btn danger" type="submit" form="registration-review" disabled={reviewBlocked}>{reject.isPending ? 'Rejecting…' : 'Reject'}</button>
          <button className="btn primary" type="button" disabled={reviewBlocked} onClick={() => {
            if (review?.applicationId != null) approve.mutate(review.applicationId, { onSuccess: () => setReview(null) })
          }}>{approve.isPending ? 'Approving…' : 'Approve'}</button>
        </div>
      </div>
    </Modal>
  </>
}
