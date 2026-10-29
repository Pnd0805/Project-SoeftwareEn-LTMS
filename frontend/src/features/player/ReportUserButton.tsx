import { useState } from 'react'
import { Banner, Field } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useReportUser } from '../../hooks/useQaFeatures'
import { uploadImage, UPLOAD_IMAGE_ACCEPT } from '../../api/upload'
export function ReportUserButton({ userId, name }: { userId: number; name: string }) {
  const report = useReportUser(userId)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const send = async () => {
    if (!reason.trim() || busy || report.isPending || files.length > 5) return
    setBusy(true); setError('')
    try {
      const evidence = []
      for (const f of files) evidence.push(await uploadImage(f, 'report_evidence'))
      await report.mutateAsync({ reason, evidence })
      setSent(true); setOpen(false); setReason(''); setFiles([])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit report.') } finally { setBusy(false) }
  }
  return <>
    <button className="btn ghost" onClick={() => { report.reset(); setError(''); setOpen(true) }}>Report user</button>
    {sent ? <span role="status">Report sent for admin review.</span> : null}
    <Modal open={open} title={`Report ${name}`} onClose={() => !busy && !report.isPending && setOpen(false)}>
      <p>An admin will review the report. Reporting does not immediately suspend this account.</p>
      <Field label="Reason" htmlFor="report-user-reason"><textarea id="report-user-reason" value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></Field>
      <Field label="Evidence (optional, up to 5 JPEG/PNG images)" htmlFor="report-user-evidence"><input id="report-user-evidence" type="file" accept={UPLOAD_IMAGE_ACCEPT} multiple disabled={busy} onChange={e => setFiles(Array.from(e.target.files ?? []))} /></Field>
      {files.length > 5 ? <Banner kind="crit">Choose at most five images.</Banner> : null}
      {error ? <Banner kind="crit">{error}</Banner> : null}
      <button className="btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>{' '}<button className="btn primary" disabled={!reason.trim() || files.length > 5 || busy || report.isPending} onClick={() => void send()}>{busy ? 'Submitting…' : 'Submit report'}</button>
    </Modal>
  </>
}
