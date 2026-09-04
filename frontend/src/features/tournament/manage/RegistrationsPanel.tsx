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
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Badge, Field, Panel, TableWrap } from '../../../components/kit/primitives'
import { TeamLink } from '../../../components/kit/chips'
import { Modal } from '../../../components/kit/Modal'
import { useLtms } from '../../../shared/store'
import {
  useAllowWithdrawal, useApproveAllRegistrations, useApproveRegistration,
  useRejectRegistration, useTournament,
} from '../../../hooks/useTournament'
import { ApiError } from '../../../api/client'
import { reviewTournamentApplicationSchema, type ReviewTournamentApplicationInput } from '../../../schemas/tournament.schema'
import { regsOf, team, user } from '../../../shared/selectors'
import { fmtDate, hardFilter } from '../../../shared/rules'
import type { State, Tournament } from '../../../shared/types'
import type { TournamentApplicationDto } from '../../../types/tournament.dto'

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

function rowsFromApi(apps: TournamentApplicationDto[]): RegRow[] {
  return apps.map(a => ({
    key: `api-${a.id}`,
    applicationId: a.id,
    teamStoreId: null,
    teamName: a.team.name,
    status: a.status,
    hardFilterPassed: a.hardFilterPassed,
    hardFilterFails: [],
    reason: a.rejectionReason,
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
  const s = useLtms()
  const navigate = useNavigate()
  const [review, setReview] = useState<RegRow | null>(null)

  /* เดียวกับ TournamentPage — id ตัวเลขเท่านั้นที่ API รู้จัก */
  const tournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  const { data: detail } = useTournament(tournamentId)
  const live = tournamentId !== undefined && !!detail

  const rows = live ? rowsFromApi(detail.applications) : rowsFromStore(s, t)
  const pend = rows.filter(r => r.status === 'pending')
  const approved = rows.filter(r => r.status === 'approved')
  const rejected = rows.filter(r => r.status === 'rejected')
  const withdrawing = rows.filter(r => r.withdrawRequested)

  /* ชั้น API รับได้ทั้ง id ตัวเลขและ id ของ store จึงส่งตัวที่หน้าถืออยู่ไปตรงๆ */
  const apiId = tournamentId ?? t.id
  const approve = useApproveRegistration(apiId)
  const approveAll = useApproveAllRegistrations(apiId)
  const reject = useRejectRegistration(apiId)
  const allowWithdraw = useAllowWithdrawal(apiId)

  const { register, handleSubmit, setError, reset, formState: { errors } } =
    useForm<ReviewTournamentApplicationInput>({ resolver: zodResolver(reviewTournamentApplicationSchema) })

  /** ปุ่มสั่งงานได้ต่อเมื่อแถวนั้นมี applicationId จริง */
  const actionable = (r: RegRow) => r.applicationId !== null
  const blockedHint = 'ใบสมัครนี้ไม่มี id ที่สั่งงานได้'

  return (
    <>
      <Panel>
        <div className="spread">
          <span className="tag"><em>//</em> Registrations</span>
          <Badge kind={pend.length ? 'warn' : 'neutral'}>{`${approved.length} in · ${pend.length} waiting`}</Badge>
        </div>

        {pend.length > 1 ? (
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" disabled={approveAll.isPending}
              onClick={() => approveAll.mutate()}>
              Approve all {pend.length}
            </button>
          </div>
        ) : null}

        {pend.length ? (
          <div className="vstack" style={{ gap: 8 }}>
            {pend.map(r => {
              const tm = r.teamStoreId ? team(s, r.teamStoreId) : null
              return (
                <div className="who" key={r.key}>
                  <span className="avatar" style={tm ? { background: tm.color } : undefined}>
                    {tm?.code ?? r.teamName.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="meta">
                    <b>{r.teamName}</b>
                    <span className="tag">
                      {tm ? `${user(s, tm.leader)?.name} · ${tm.members.length} players · ` : ''}
                      {r.at ? fmtDate(r.at) : '—'}
                    </span>
                  </span>
                  {r.hardFilterPassed === false
                    ? <Badge kind="crit">{r.hardFilterFails.length ? `${r.hardFilterFails.length} failed` : 'Failed'}</Badge>
                    : r.hardFilterPassed ? <Badge kind="ok">Passed</Badge> : <Badge kind="neutral">Not checked</Badge>}
                  <span className="hstack">
                    <button className="btn ghost" type="button" onClick={() => setReview(r)}>Review</button>
                    <button className="btn primary" type="button"
                      disabled={!actionable(r) || approve.isPending}
                      title={actionable(r) ? undefined : blockedHint}
                      onClick={() => { if (r.applicationId !== null) approve.mutate(r.applicationId) }}>
                      Approve
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        ) : null}

        {withdrawing.length ? (
          <>
            <div className="tag" style={{ marginTop: 6 }}>
              <em>//</em> Withdrawal requests — the bracket is live, so these are yours to allow
            </div>
            <TableWrap>
              <table>
                <thead><tr><th>Squad</th><th>Effect if allowed</th><th /></tr></thead>
                <tbody>
                  {withdrawing.map(r => (
                    <tr key={r.key}>
                      <td>{r.teamStoreId ? <TeamLink id={r.teamStoreId} /> : r.teamName}</td>
                      <td className="sub">Every remaining opponent receives a walkover.</td>
                      <td>
                        <button className="btn danger" type="button"
                          disabled={!actionable(r) || allowWithdraw.isPending}
                          title={actionable(r) ? undefined : blockedHint}
                          onClick={() => { if (r.applicationId !== null) allowWithdraw.mutate(r.applicationId) }}>
                          Allow withdrawal
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        ) : null}

        {approved.length ? (
          <>
            <div className="tag" style={{ marginTop: 6 }}><em>//</em> Approved</div>
            <div className="vstack" style={{ gap: 8 }}>
              {approved.map(r => {
                const tm = r.teamStoreId ? team(s, r.teamStoreId) : null
                return (
                  <div className="who" key={r.key}>
                    <span className="avatar" style={tm ? { background: tm.color } : undefined}>
                      {tm?.code ?? r.teamName.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="meta">
                      <b>{r.teamName}</b>
                      <span className="tag">
                        {tm ? `${user(s, tm.leader)?.name} · ${tm.members.length} players` : 'via API'}
                      </span>
                    </span>
                    {tm ? (
                      <button className="btn ghost" type="button" onClick={() => navigate(`/team/${tm.id}`)}>View squad</button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </>
        ) : null}

        {rejected.length ? (
          <>
            <div className="tag" style={{ marginTop: 6 }}>
              <em>//</em> Rejected by the hard filter — a record, not a decision
            </div>
            <TableWrap>
              <table>
                <thead><tr><th>Squad</th><th>Failed on</th></tr></thead>
                <tbody>
                  {rejected.map(r => (
                    <tr key={r.key}>
                      <td>{r.teamStoreId ? <TeamLink id={r.teamStoreId} /> : r.teamName}</td>
                      <td className="sub">{r.reason ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        ) : null}
      </Panel>

      <Modal open={!!review} onClose={() => setReview(null)} label="Soft filter — your judgement"
        title={review?.teamName}>
        {t.entryNotes ? (
          <div className="panel quiet vstack">
            <span className="tag"><em>//</em> What you asked for</span>
            <div style={{ fontSize: 15, lineHeight: 1.55 }}>{t.entryNotes}</div>
          </div>
        ) : null}
        {review?.squad.length ? (
          <TableWrap>
            <table>
              <thead><tr><th>Player</th><th>Faculty</th><th>Year</th></tr></thead>
              <tbody>
                {review.squad.map(id => {
                  const p = user(s, id)
                  return p ? <tr key={id}><td>{p.name}</td><td className="sub">{p.faculty}</td><td className="num">{p.year}</td></tr> : null
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          /* API ยังไม่ส่งรายชื่อผู้เล่นในใบสมัคร — ไม่วาดตารางเปล่าให้เข้าใจผิดว่าไม่มีคน */
          <div className="sub">รายชื่อผู้เล่นในใบสมัครยังไม่มีใน API — ดูได้จากหน้าทีม</div>
        )}
        {review?.hardFilterFails.length ? (
          <div className="banner crit">
            <span className="grow">
              <b>The hard filter refuses this squad.</b> {review.hardFilterFails.join('; ')}
            </span>
          </div>
        ) : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setReview(null)}>Cancel</button>
          <form onSubmit={handleSubmit(async input => {
            if (!review || review.applicationId === null) return
            try {
              await reject.mutateAsync({ applicationId: review.applicationId, rejectionReason: input.rejectionReason ?? '' })
              setReview(null); reset()
            }
            catch (error) { if (error instanceof ApiError && error.fields) Object.entries(error.fields).forEach(([field, message]) => setError(field as keyof ReviewTournamentApplicationInput, { type: 'server', message })) }
          })}>
          <input type="hidden" value="rejected" {...register('status')} />
          <Field label="Reason" htmlFor="registration-reason">
            <textarea id="registration-reason" rows={3} {...register('rejectionReason')} />
            {errors.rejectionReason?.message ? <span className="sub">{errors.rejectionReason.message}</span> : null}
          </Field>
          <button className="btn danger" type="submit"
            disabled={!review || !actionable(review) || reject.isPending}
            title={review && actionable(review) ? undefined : blockedHint}>
            Decline
          </button>
          <button className="btn primary" type="button"
            disabled={!review || !actionable(review) || approve.isPending}
            title={review && actionable(review) ? undefined : blockedHint}
            onClick={() => { if (review?.applicationId != null) approve.mutate(review.applicationId, { onSuccess: () => setReview(null) }) }}>
            Approve
          </button>
          </form>
        </div>
      </Modal>
    </>
  )
}
