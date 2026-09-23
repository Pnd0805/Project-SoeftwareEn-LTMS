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
  return <Panel quiet>
    <span className="tag"><em>//</em> Feedback moderation · university admin</span>
    <p className="sub">Enter the feedback ID shown on a tournament's comments or reviews. Removal excludes it from public counts. Restore clears its report flag.</p>
    <Field label="Feedback ID" htmlFor="feedback-id"><input id="feedback-id" inputMode="numeric" value={idText} onChange={event => setIdText(event.target.value)} /></Field>
    <Field label="Reason (optional for admin removal)" htmlFor="feedback-reason"><textarea id="feedback-reason" maxLength={255} value={reason} onChange={event => setReason(event.target.value)} /></Field>
    <div className="hstack">
      <button className="btn" type="button" disabled={!valid || remove.isPending || restore.isPending} onClick={() => remove.mutate()}>Remove</button>
      <button className="btn" type="button" disabled={!valid || remove.isPending || restore.isPending} onClick={() => restore.mutate()}>Restore</button>
    </div>
    {error ? <p role="alert" className="sub">{error instanceof Error ? error.message : 'Moderation failed.'}</p> : null}
    {notice ? <p role="status" className="sub">{notice}</p> : null}
  </Panel>
}
