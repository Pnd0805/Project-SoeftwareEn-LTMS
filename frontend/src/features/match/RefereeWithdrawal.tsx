import { useState } from 'react'
import { Badge, Banner, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useAcceptRefereeRequest, useAssignableReferees, useDeclineRefereeRequest, useRequestRefereeWithdrawal, useTournamentRefereeRequests } from '../../hooks/useAdmin'
import type { BackendRefereeRequestDto } from '../../types/admin.dto'

const message = (e: unknown) => e instanceof Error ? e.message : 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่'

export function RefereeWithdrawal({ tournamentId, matchId }: { tournamentId: number; matchId?: number }) {
  const mutation = useRequestRefereeWithdrawal()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<'match' | 'tournament'>(matchId ? 'match' : 'tournament')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const valid = reason.trim().length >= 5 && reason.trim().length <= 500
  return <Panel quiet>
    <h3>ขอถอนตัวจากหน้าที่กรรมการ</h3>
    <div className="sub">ยังรับผิดชอบงานเดิมจนกว่าผู้จัดจะอนุมัติคำขอ</div>
    {notice ? <Banner kind="ok">{notice}</Banner> : null}
    <button className="btn" onClick={() => { mutation.reset(); setReason(''); setOpen(true) }}>Request withdrawal</button>
    <Modal open={open} onClose={() => { if (!mutation.isPending) setOpen(false) }} label="Request referee withdrawal" title="ยืนยันคำขอถอนตัว">
      <Field label="ขอบเขตการถอนตัว" htmlFor={`withdraw-scope-${tournamentId}-${matchId ?? 'all'}`}>
        <select id={`withdraw-scope-${tournamentId}-${matchId ?? 'all'}`} value={scope} disabled={mutation.isPending} onChange={e => setScope(e.target.value as 'match' | 'tournament')}>
          {matchId ? <option value="match">เฉพาะแมตช์ #{matchId}</option> : null}
          <option value="tournament">ทั้งทัวร์นาเมนต์ #{tournamentId}</option>
        </select>
      </Field>
      <Banner kind="warn">{scope === 'match' ? `ขอออกจากแมตช์ #${matchId} โดยยังเป็นกรรมการของทัวร์` : 'ขอออกจากทัวร์นี้และงานกรรมการที่เกี่ยวข้องทั้งหมด'} · การส่งคำขอยังไม่ถอนคุณออกทันที</Banner>
      <Field label="เหตุผล (5–500 ตัวอักษร)" htmlFor={`withdraw-reason-${tournamentId}-${matchId ?? 'all'}`}>
        <textarea id={`withdraw-reason-${tournamentId}-${matchId ?? 'all'}`} value={reason} maxLength={500} disabled={mutation.isPending} onChange={e => setReason(e.target.value)} />
      </Field>
      {mutation.isError ? <Banner kind="crit">{message(mutation.error)}</Banner> : null}
      <div className="hstack"><button className="btn" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn primary" disabled={!valid || mutation.isPending} onClick={() => {
          if (!valid || mutation.isPending) return
          mutation.mutate(scope === 'match' && matchId ? { scope, matchId, reason: reason.trim() } : { scope: 'tournament', tournamentId, reason: reason.trim() }, {
            onSuccess: r => { setNotice(`ส่งคำขอ #${r.id} แล้ว สถานะ: ${r.status === 'open' ? 'รอผู้จัดพิจารณา' : r.status}`); setOpen(false) },
          })
        }}>{mutation.isPending ? 'Sending…' : 'Send withdrawal request'}</button>
      </div>
    </Modal>
  </Panel>
}

/** This referee-readable endpoint also verifies active tournament membership, including an unassigned pool referee. */
export function TournamentRefereeWithdrawal({ tournamentId }: { tournamentId: number }) {
  const membership = useAssignableReferees(tournamentId)
  if (membership.isPending) return <span className="sub">Checking referee access…</span>
  if (membership.isError) {
    const status = (membership.error as { status?: number }).status
    if (status === 401 || status === 403) return null
    return <Banner kind="crit">ตรวจสิทธิ์กรรมการไม่สำเร็จ <button className="btn" onClick={() => void membership.refetch()}>Retry</button></Banner>
  }
  return <RefereeWithdrawal tournamentId={tournamentId} />
}

export function OrganizerWithdrawals({ tournamentId }: { tournamentId: number }) {
  const requests = useTournamentRefereeRequests(tournamentId)
  const accept = useAcceptRefereeRequest()
  const decline = useDeclineRefereeRequest()
  const [selected, setSelected] = useState<{ request: BackendRefereeRequestDto; approve: boolean } | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)
  const [history, setHistory] = useState(false)
  const busy = accept.isPending || decline.isPending
  const rows = (requests.data?.items ?? []).filter(r => r.type === 'ref_withdraw' && (history || r.status === 'open'))
  return <Panel quiet>
    <h3>คำขอถอนตัวกรรมการ</h3>
    <label><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} /> แสดงประวัติที่ตัดสินแล้ว</label>
    {requests.isPending ? <span className="sub">Loading withdrawal requests…</span> : null}
    {requests.isError ? <Banner kind="crit">{message(requests.error)} <button className="btn" onClick={() => void requests.refetch()}>Retry</button></Banner> : null}
    {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}
    {requests.isSuccess && !rows.length ? <span className="sub">ไม่มีคำขอถอนตัวในรายการนี้</span> : null}
    {rows.map(r => <div className="vstack" style={{ gap: 8, marginTop: 12 }} key={r.id}>
      <b>{r.refereeA.user.fullName} · {r.withdrawScope === 'tournament' ? 'ถอนจากทั้งทัวร์' : `ถอนจากแมตช์ #${r.matchA?.id ?? '—'}`}</b>
      <div style={{ whiteSpace: 'pre-wrap' }}>เหตุผล: {r.reason ?? 'ไม่ระบุ'}</div>
      <div className="sub">ยื่นเมื่อ {new Date(r.createdAt).toLocaleString()}</div>
      <Badge kind={r.status === 'open' ? 'warn' : r.status === 'applied' ? 'ok' : 'neutral'}>{r.status}</Badge>
      {r.status === 'open' ? <div className="hstack">
        <button className="btn" disabled={busy} onClick={() => { accept.reset(); decline.reset(); setSelected({ request: r, approve: false }) }}>Decline withdrawal</button>
        <button className="btn primary" disabled={busy} onClick={() => { accept.reset(); decline.reset(); setSelected({ request: r, approve: true }) }}>Approve withdrawal</button>
      </div> : null}
    </div>)}
    <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null) }} label="Review referee withdrawal" title={selected?.request.refereeA.user.fullName ?? ''}>
      <p>{selected?.request.reason}</p>
      <Banner kind="warn">{selected?.approve ? selected.request.withdrawScope === 'tournament' ? 'อนุมัติแล้วกรรมการจะออกจากทัวร์นี้ ตรวจแมตช์ที่ขาดกรรมการและจัดคนแทน' : `อนุมัติแล้วกรรมการจะออกจากแมตช์ #${selected.request.matchA?.id} ตรวจและจัดคนแทน` : 'ปฏิเสธแล้วกรรมการยังรับผิดชอบงานเดิม'}</Banner>
      {accept.isError || decline.isError ? <Banner kind="crit">{message(accept.error ?? decline.error)}</Banner> : null}
      <button className="btn" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>{' '}
      <button className="btn primary" disabled={busy} onClick={() => {
        if (!selected || busy) return
        const mutation = selected.approve ? accept : decline
        mutation.mutate(selected.request.id, { onSuccess: r => { setNotice({ kind: r.status === 'applied' || r.status === 'declined' ? 'ok' : 'warn', text: `คำขอ #${r.id}: ${r.status === 'applied' ? 'อนุมัติการถอนตัวแล้ว' : r.status === 'declined' ? 'ปฏิเสธแล้ว' : `สถานะ ${r.status} กรุณาตรวจข้อมูลล่าสุด`}` }); setSelected(null) } })
      }}>{busy ? 'Saving…' : 'Confirm decision'}</button>
    </Modal>
  </Panel>
}
