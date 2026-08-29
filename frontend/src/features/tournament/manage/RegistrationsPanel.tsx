/**
 * src/features/tournament/manage/RegistrationsPanel.tsx
 *
 * The Soft filter: the Organizer's review of a registration that already cleared
 * the Hard filter. Rejections by the Hard filter are listed too — as a record,
 * not a decision, because nobody here made it and nobody can undo it.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Panel, TableWrap } from '../../../components/kit/primitives'
import { TeamLink } from '../../../components/kit/chips'
import { Modal } from '../../../components/kit/Modal'
import { allowWithdraw, approveAll, approveRegistration, rejectRegistration, useLtms } from '../../../shared/store'
import { regsOf, team, user } from '../../../shared/selectors'
import { fmtDate, hardFilter } from '../../../shared/rules'
import type { Registration, Tournament } from '../../../shared/types'

export function RegistrationsPanel({ t }: { t: Tournament }) {
  const s = useLtms()
  const navigate = useNavigate()
  const [review, setReview] = useState<Registration | null>(null)
  const regs = regsOf(s, t.id)
  const pend = regs.filter(r => r.status === 'pending')
  const approved = regs.filter(r => r.status === 'approved')
  const rejected = regs.filter(r => r.status === 'rejected')
  const withdrawing = regs.filter(r => r.withdrawRequested)

  const reviewTeam = review ? team(s, review.team) : null
  const fails = review && reviewTeam ? hardFilter(s, reviewTeam, t, review.squad) : []

  return (
    <>
      <Panel>
        <div className="spread">
          <span className="tag"><em>//</em> Registrations</span>
          <Badge kind={pend.length ? 'warn' : 'neutral'}>{`${approved.length} in · ${pend.length} waiting`}</Badge>
        </div>

        {pend.length > 1 ? (
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => approveAll(t.id)}>Approve all {pend.length}</button>
          </div>
        ) : null}

        {pend.length ? (
          <div className="vstack" style={{ gap: 8 }}>
            {pend.map(r => {
              const tm = team(s, r.team)
              if (!tm) return null
              const f = hardFilter(s, tm, t, r.squad)
              return (
                <div className="who" key={r.id}>
                  <span className="avatar" style={{ background: tm.color }}>{tm.code}</span>
                  <span className="meta">
                    <b>{tm.name}</b>
                    <span className="tag">{user(s, tm.leader)?.name} · {tm.members.length} players · {fmtDate(r.at)}</span>
                  </span>
                  {f.length ? <Badge kind="crit">{`${f.length} failed`}</Badge> : <Badge kind="ok">Passed</Badge>}
                  <span className="hstack">
                    <button className="btn ghost" type="button" onClick={() => setReview(r)}>Review</button>
                    <button className="btn primary" type="button" onClick={() => approveRegistration(r.id)}>Approve</button>
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
                    <tr key={r.id}>
                      <td><TeamLink id={r.team} /></td>
                      <td className="sub">Every remaining opponent receives a walkover.</td>
                      <td><button className="btn danger" type="button" onClick={() => allowWithdraw(r.id)}>Allow withdrawal</button></td>
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
                const tm = team(s, r.team)
                if (!tm) return null
                return (
                  <div className="who" key={r.id}>
                    <span className="avatar" style={{ background: tm.color }}>{tm.code}</span>
                    <span className="meta">
                      <b>{tm.name}</b>
                      <span className="tag">{user(s, tm.leader)?.name} · {tm.members.length} players</span>
                    </span>
                    <button className="btn ghost" type="button" onClick={() => navigate(`/team/${tm.id}`)}>View squad</button>
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
                    <tr key={r.id}><td><TeamLink id={r.team} /></td><td className="sub">{r.reason ?? ''}</td></tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        ) : null}
      </Panel>

      <Modal open={!!review} onClose={() => setReview(null)} label="Soft filter — your judgement"
        title={reviewTeam?.name}>
        {t.entryNotes ? (
          <div className="panel quiet vstack">
            <span className="tag"><em>//</em> What you asked for</span>
            <div style={{ fontSize: 15, lineHeight: 1.55 }}>{t.entryNotes}</div>
          </div>
        ) : null}
        <TableWrap>
          <table>
            <thead><tr><th>Player</th><th>Faculty</th><th>Year</th></tr></thead>
            <tbody>
              {(review?.squad ?? []).map(id => {
                const p = user(s, id)
                return p ? <tr key={id}><td>{p.name}</td><td className="sub">{p.faculty}</td><td className="num">{p.year}</td></tr> : null
              })}
            </tbody>
          </table>
        </TableWrap>
        {fails.length ? (
          <div className="banner crit">
            <span className="grow">
              <b>The hard filter refuses this squad.</b> {fails.map(f => `${f.user.name} — ${f.rule}`).join('; ')}
            </span>
          </div>
        ) : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setReview(null)}>Cancel</button>
          <button className="btn danger" type="button"
            onClick={() => { if (review) rejectRegistration(review.id, 'Declined on the entry notes'); setReview(null) }}>
            Decline
          </button>
          <button className="btn primary" type="button"
            onClick={() => { if (review) approveRegistration(review.id); setReview(null) }}>
            Approve
          </button>
        </div>
      </Modal>
    </>
  )
}
