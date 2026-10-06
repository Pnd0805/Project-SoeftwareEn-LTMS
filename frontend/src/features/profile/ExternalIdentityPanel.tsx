import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Banner, Field, Panel } from '../../components/kit/primitives'
import { useRefereeIdentity, useSubmitRefereeIdentityDocs } from '../../hooks/useAdmin'
import { imageUploadErrorMessage, uploadImage, UPLOAD_IMAGE_ACCEPT } from '../../api/upload'
import { RefereeWithdrawal } from '../match/RefereeWithdrawal'

const statusLabel = { none: 'External', pending: 'External — Pending', needs_docs: 'External — Needs documents', approved: 'External (Approve)', rejected: 'External — Rejected' }
export function ExternalIdentityBadge() {
  const identity = useRefereeIdentity()
  return <Badge kind={identity.data?.status === 'approved' ? 'ok' : 'warn'}>
    {identity.isPending ? 'External — Checking approval' : identity.isError ? 'External — Approval unavailable' : statusLabel[identity.data?.status ?? 'none']}
  </Badge>
}

export function ExternalIdentityPanel() {
  const query = useRefereeIdentity()
  const submit = useSubmitRefereeIdentityDocs()
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selection, setSelection] = useState(0)
  const identity = query.data
  const send = async () => {
    if (busy || submit.isPending || !files.length || files.length > 5 || !identity?.docsRequired) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (files.some(f => !['image/png', 'image/jpeg'].includes(f.type))) throw new Error('เลือกไฟล์ JPEG หรือ PNG เท่านั้น')
      const keys: string[] = []
      for (const file of files) keys.push(await uploadImage(file, 'referee_identity'))
      await submit.mutateAsync(keys)
      setNotice('ส่งเอกสารแล้ว รอผู้ดูแลระบบตรวจสอบ'); setFiles([]); setSelection(n => n + 1)
    } catch (e) { setError(imageUploadErrorMessage(e)) } finally { setBusy(false) }
  }
  return <Panel quiet>
    <h3>External referee identity</h3>
    {query.isPending ? <span className="sub">Checking identity…</span> : null}
    {query.isError ? <Banner kind="crit">ตรวจสถานะไม่สำเร็จ {query.error instanceof Error ? query.error.message : ''} <button className="btn" onClick={() => void query.refetch()}>Retry</button></Banner> : null}
    {identity ? <>
      <div>สถานะการตรวจ: {statusLabel[identity.status]}</div>
      {identity.expiresAt ? <div className="sub">Approved until {new Date(identity.expiresAt).toLocaleDateString()}</div> : null}
      {identity.adminMessage ? <Banner kind="warn">ข้อความจากผู้ดูแล: {identity.adminMessage}</Banner> : null}
      {identity.status === 'rejected' ? <div className="sub">ติดต่อผู้จัดให้เชิญใหม่ก่อนส่งเอกสารอีกครั้ง</div> : null}
      {identity.tournaments.map(t => <div key={t.tournamentRefereeId}><Link to={`/t/${t.id}`}>{t.name}</Link> · {t.externalApprovalStatus}</div>)}
      {identity.status === 'approved' ? identity.tournaments.filter(t => t.externalApprovalStatus === 'approved').map(t => <RefereeWithdrawal key={t.tournamentRefereeId} tournamentId={t.id} />) : null}
      {identity.docsSubmitted && !identity.docsRequired ? <div className="sub">ได้รับเอกสารแล้ว ไม่ต้องส่งซ้ำระหว่างรอตรวจ</div> : null}
      {identity.docsRequired && identity.tournaments.length > 0 ? <>
        <Field label="เอกสารยืนยันตัวตน (JPEG/PNG 1–5 ไฟล์)" htmlFor="ref-identity-files">
          <input key={selection} id="ref-identity-files" type="file" accept={UPLOAD_IMAGE_ACCEPT} multiple disabled={busy || submit.isPending}
            onChange={e => { setFiles(Array.from(e.target.files ?? [])); setError(''); setNotice('') }} />
        </Field>
        {files.map((f, i) => <div className="sub" key={`${i}:${f.name}`}>{f.name}</div>)}
        {files.length > 5 ? <Banner kind="crit">แนบได้ไม่เกิน 5 ไฟล์</Banner> : null}
        <button className="btn primary" disabled={busy || submit.isPending || !files.length || files.length > 5} onClick={() => void send()}>{busy ? 'Uploading…' : 'ส่งเอกสารให้ผู้ดูแล'}</button>
      </> : identity.status === 'none' ? <div className="sub">ตอบรับคำเชิญกรรมการก่อนส่งเอกสารยืนยันตัวตน</div> : null}
    </> : null}
    {error ? <Banner kind="crit">{error}</Banner> : null}
    {notice ? <Banner kind="ok">{notice}</Banner> : null}
  </Panel>
}
