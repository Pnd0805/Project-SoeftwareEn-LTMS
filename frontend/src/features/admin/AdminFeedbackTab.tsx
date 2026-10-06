import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { removeFeedbackByAdmin, restoreFeedbackByAdmin } from '../../api/liveEngagement'
import { Field, Panel } from '../../components/kit/primitives'

export function AdminFeedbackTab() {
  const qc = useQueryClient()
  const [idText, setIdText] = useState('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const id = Number(idText)
  const valid = Number.isSafeInteger(id) && id > 0
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['liveComments'] })
    void qc.invalidateQueries({ queryKey: ['liveReviews'] })
  }
  const remove = useMutation({ mutationFn: () => removeFeedbackByAdmin(id, reason.trim() || undefined), onSuccess: () => { setNotice(`Feedback #${id} removed.`); refresh() } })
  const restore = useMutation({ mutationFn: () => restoreFeedbackByAdmin(id), onSuccess: () => { setNotice(`Feedback #${id} restored.`); refresh() } })
  const error = remove.error ?? restore.error
  const busy = remove.isPending || restore.isPending
  return <Panel quiet className="admin-feedback">
    <h2>Feedback moderation</h2>
    <p className="sub">Enter the feedback ID shown on a tournament's comments or reviews. Removal excludes it from public counts. Restore clears its report flag.</p>
    <Field label="Feedback ID" htmlFor="feedback-id"><input id="feedback-id" disabled={busy} inputMode="numeric" value={idText} onChange={event => setIdText(event.target.value)} /></Field>
    <Field label="Reason (optional)" htmlFor="feedback-reason"><textarea id="feedback-reason" disabled={busy} maxLength={255} value={reason} onChange={event => setReason(event.target.value)} /></Field>
    <div className="hstack">
      <button className="btn danger" type="button" disabled={!valid || busy} onClick={() => remove.mutate()}>{remove.isPending ? 'Removing…' : 'Remove'}</button>
      <button className="btn" type="button" disabled={!valid || busy} onClick={() => restore.mutate()}>{restore.isPending ? 'Restoring…' : 'Restore'}</button>
    </div>
    {error ? <p role="alert" className="sub">{error instanceof Error ? error.message : 'Moderation failed.'}</p> : null}
    {notice ? <p role="status" className="sub">{notice}</p> : null}
  </Panel>
}
