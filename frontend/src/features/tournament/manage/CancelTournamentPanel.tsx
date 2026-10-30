import { useRef, useState } from 'react'
import { USE_MOCK } from '../../../api/client'
import { ContractErrorDetails } from '../../../components/kit/ContractErrorDetails'
import { Modal } from '../../../components/kit/Modal'
import { Banner, Field, Panel } from '../../../components/kit/primitives'
import { useCancelTournament } from '../../../hooks/useTournament'
import type { Tournament } from '../../../shared/types'
import { useManageActive } from './ManageActivity'
import { useRegistrationStarted } from './useRegistrationStarted'

export function CancelTournamentPanel({ t }: { t: Tournament }) {
  const active = useManageActive()
  const cancel = useCancelTournament(Number(t.id))
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [name, setName] = useState('')
  const submitting = useRef(false)
  const started = useRegistrationStarted(t)
  const valid = reason.trim().length > 0 && reason.trim().length <= 255 && name === t.name
  /* ก่อนเริ่มรับสมัครไม่มีใครเสียหาย ใช้การลบแทน (DeleteTournamentPanel) */
  if (USE_MOCK || t.champion || !started || !['public', 'private'].includes(t.status)) return null

  return <Panel quiet>
    <h2>Cancel tournament</h2>
    <p className="sub">End this tournament permanently and keep its history available.</p>
    <button className="btn danger" type="button" onClick={() => { cancel.reset(); setReason(''); setName(''); setOpen(true) }}>Cancel tournament</button>
    <Modal open={active && open} label="Cancel tournament permanently" title={t.name} onClose={() => { if (!submitting.current) setOpen(false) }}>
      <form className="vstack" onSubmit={async event => {
        event.preventDefault()
        if (!valid || submitting.current || !active) return
        submitting.current = true
        try { await cancel.mutateAsync(reason.trim()); setOpen(false) }
        catch { /* แสดงข้อผิดพลาดของ server ในกล่องเดิมและเก็บเหตุผลให้แก้ได้ */ }
        finally { submitting.current = false }
      }}>
        <Banner kind="crit"><b>This cannot be undone.</b> Registration closes immediately and all remaining matches stop. Teams, players, referees and prediction participants are notified. History stays visible.</Banner>
        <Field label="Cancellation reason" htmlFor="cancel-tournament-reason">
          <textarea id="cancel-tournament-reason" required maxLength={255} value={reason} disabled={cancel.isPending} onChange={event => setReason(event.target.value)} />
        </Field>
        <Field label={`Type the tournament name: ${t.name}`} htmlFor="cancel-tournament-name">
          <input id="cancel-tournament-name" autoComplete="off" value={name} disabled={cancel.isPending} onChange={event => setName(event.target.value)} />
        </Field>
        {cancel.isError ? <Banner kind="crit">{cancel.error instanceof Error ? cancel.error.message : 'Unable to cancel. Try again.'}<ContractErrorDetails error={cancel.error} /></Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" disabled={cancel.isPending} onClick={() => setOpen(false)}>Keep tournament</button>
          <button className="btn danger" type="submit" disabled={!valid || cancel.isPending}>{cancel.isPending ? 'Cancelling…' : 'Cancel tournament permanently'}</button>
        </div>
      </form>
    </Modal>
  </Panel>
}
