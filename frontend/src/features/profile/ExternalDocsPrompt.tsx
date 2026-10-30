/**
 * ชวนกรรมการภายนอกส่งเอกสารทันทีหลังตอบรับคำเชิญ — ไม่บังคับ ข้ามแล้วส่งภายหลังที่หน้าโปรไฟล์ได้
 *
 * เปิดหลังตอบรับสำเร็จเท่านั้น เพราะ PUT /me/referee-identity/docs ต้องมีแถวที่รอตรวจก่อน
 * ผู้เรียกต้องวางไว้นอกแถวคำเชิญ เพราะแถวหายทันทีที่ตอบรับแล้ว
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner, Field } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { imageUploadErrorMessage, IDENTITY_DOC_ACCEPT } from '../../api/upload'
import { useSubmitRefereeIdentityDocs } from '../../hooks/useAdmin'
import { uploadIdentityDocs } from './identityDocs'

export function ExternalDocsPrompt({ tournament, onClose, onSent }: {
  tournament: string
  onClose: () => void
  onSent: (tournament: string) => void
}) {
  const submit = useSubmitRefereeIdentityDocs()
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sending = busy || submit.isPending
  const close = () => { if (!sending) onClose() }
  const send = async () => {
    if (sending || !files.length || files.length > 5) return
    setBusy(true); setError('')
    try {
      await submit.mutateAsync(await uploadIdentityDocs(files))
      onSent(tournament)
    } catch (e) { setError(imageUploadErrorMessage(e)); setBusy(false) }
  }
  return (
    <Modal open onClose={close} label="External referee" title="Send identity documents">
      <p>You accepted {tournament}. An admin must verify your identity before you can officiate.</p>
      <Banner kind="neutral">This step is optional. To attach documents later, go to your <Link to="/me">Profile page</Link>.</Banner>
      <Field label="Documents (PDF/JPEG/PNG, 1–5 files)" htmlFor="external-docs-files">
        <input id="external-docs-files" type="file" accept={IDENTITY_DOC_ACCEPT} multiple disabled={sending}
          onChange={e => { setFiles(Array.from(e.target.files ?? [])); setError('') }} />
      </Field>
      {files.map((f, i) => <div className="sub" key={`${i}:${f.name}`}>{f.name}</div>)}
      {files.length > 5 ? <Banner kind="crit">Attach no more than 5 files.</Banner> : null}
      {error ? <Banner kind="crit">{error}</Banner> : null}
      <div className="hstack">
        <button className="btn" type="button" disabled={sending} onClick={close}>Skip for now</button>
        <button className="btn primary" type="button" disabled={sending || !files.length || files.length > 5} onClick={() => void send()}>{sending ? 'Uploading…' : 'Send documents'}</button>
      </div>
    </Modal>
  )
}
