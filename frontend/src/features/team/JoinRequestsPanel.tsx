import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useJoinRequests } from '../../hooks/useQaFeatures'
import type { JoinRequest } from '../../api/qaFeatures'
import { ContractErrorDetails } from '../../components/kit/ContractErrorDetails'

export function JoinRequestsPanel({ teamId, visibility, leader, member, signedIn, membershipPending }: {
  teamId: number; visibility?: string; leader: boolean; member: boolean; signedIn: boolean; membershipPending: boolean
}) {
  const { team, mine, action } = useJoinRequests(teamId, leader, signedIn)
  const [message, setMessage] = useState('')
  const [review, setReview] = useState<{ row: JoinRequest; approve: boolean } | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const own = mine.data?.items.find(r => r.team.id === teamId && r.status === 'pending')
  const act = (input: Parameters<typeof action.mutate>[0]) => action.mutate(input, {
    onSuccess: () => { setReview(null); setNotice(input.kind === 'join' ? 'Request sent. The leader will review it.' : 'Saved.'); setMessage('') },
  })
  return <Panel quiet><h3>{leader ? 'Visibility and join requests' : 'Join this squad'}</h3>
    {notice ? <p role="status">{notice}</p> : null}
    {action.isError ? <Banner kind="crit">{action.error.message}<ContractErrorDetails error={action.error} /></Banner> : null}
    {leader ? <>
      <Field label="Squad visibility" htmlFor={`visibility-${teamId}`}><select id={`visibility-${teamId}`} value={visibility ?? 'private'} disabled={action.isPending} onChange={e => act({ kind: 'visibility', visibility: e.target.value as 'public' | 'private' })}><option value="private">Private — invitation only</option><option value="public">Public — searchable, accepts join requests</option></select></Field>
      <p className="sub">Public squads appear in search. Joining still requires your approval.</p>
      {team.isPending ? <p>Loading join requests…</p> : null}
      {team.isError ? <Banner kind="crit">{team.error instanceof Error ? team.error.message : 'Request failed.'} <button className="btn" onClick={() => void team.refetch()}>Retry requests</button></Banner> : null}
      {team.data?.items.filter(r => r.status === 'pending').map(r => <article className="panel quiet" key={r.id}>
        <Link to={`/player/${r.user.id}`}>{r.user.fullName}</Link><p style={{ whiteSpace: 'pre-wrap' }}>{r.message || 'No message'}</p>
        <button className="btn" disabled={action.isPending} onClick={() => { action.reset(); setReason(''); setReview({ row: r, approve: false }) }}>Reject request</button>{' '}
        <button className="btn primary" disabled={action.isPending} onClick={() => { action.reset(); setReview({ row: r, approve: true }) }}>Review admission</button>
      </article>)}
      {team.isSuccess && !team.data.items.some(r => r.status === 'pending') ? <p>No pending join requests.</p> : null}
    </> : member ? <p>You are already a member.</p> : !signedIn ? <p><Link to="/login">Sign in</Link> to request admission.</p> : <>
      {mine.isError ? <Banner kind="crit">Could not check your pending requests. <button className="btn" onClick={() => void mine.refetch()}>Retry</button></Banner> : null}
      {own ? <><p>Pending leader review.</p><button className="btn" disabled={action.isPending} onClick={() => act({ kind: 'cancel', id: own.id })}>Cancel join request</button></>
        : visibility === 'public' ? <><Field label="Message to the leader (optional)" htmlFor={`join-message-${teamId}`}><textarea id={`join-message-${teamId}`} maxLength={255} value={message} onChange={e => setMessage(e.target.value)} /></Field><button className="btn primary" disabled={membershipPending || mine.isPending || mine.isError || action.isPending} onClick={() => act({ kind: 'join', message })}>Request to join</button></> : <p>This squad is private. Ask the leader for an invitation.</p>}
    </>}
    <Modal open={!!review} title={`${review?.approve ? 'Admit' : 'Reject'} ${review?.row.user.fullName ?? ''}?`} onClose={() => !action.isPending && setReview(null)}>
      <p>{review?.approve ? 'They will become a squad member. The server checks membership limits and conflicts before admission.' : 'They will remain outside the squad.'}</p>
      {!review?.approve ? <Field label="Reason (optional)" htmlFor="join-reject-reason"><textarea id="join-reject-reason" maxLength={255} value={reason} onChange={e => setReason(e.target.value)} /></Field> : null}
      {action.isError ? <Banner kind="crit">{action.error.message}<ContractErrorDetails error={action.error} /></Banner> : null}
      <button className="btn" disabled={action.isPending} onClick={() => setReview(null)}>Cancel</button>{' '}
      <button className="btn primary" disabled={action.isPending} onClick={() => review && act({ kind: 'review', id: review.row.id, approve: review.approve, reason: reason.trim() })}>Confirm decision</button>
    </Modal>
  </Panel>
}
