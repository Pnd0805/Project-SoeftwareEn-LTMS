import { useState } from 'react'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { useMe } from '../../hooks/useAuth'
import { useAdminScopes, useAuditLogs, useGrantAdminScope, useRevokeAdminScope } from '../../hooks/useAdmin'
import { useFaculties } from '../../hooks/useReference'
import { Modal } from '../../components/kit/Modal'
import type { AdminScopeDto } from '../../types/admin.dto'
const message = (error: unknown) => error instanceof Error ? error.message : 'Request failed.'
export function AdminScopesTab() {
  const me = useMe(); const scopes = useAdminScopes(); const faculties = useFaculties()
  const grant = useGrantAdminScope(); const revoke = useRevokeAdminScope()
  const [userId, setUserId] = useState(''); const [facultyId, setFacultyId] = useState('')
  const [review, setReview] = useState(false); const [removing, setRemoving] = useState<AdminScopeDto | null>(null)
  const actor = me.data?.adminScope?.scopeType
  const target = actor === 'root' ? 'university_wide' : 'faculty'
  const canGrant = actor === 'root' || actor === 'university_wide'
  const valid = Number.isInteger(Number(userId)) && Number(userId) > 0 && (target === 'university_wide' || faculties.data?.items.some(f => f.id === Number(facultyId)))
  const busy = grant.isPending || revoke.isPending
  return <Panel quiet><h3>Admin rights</h3>
    {scopes.isPending ? <p>Loading rights...</p> : null}
    {scopes.error ? <Banner kind="crit">{message(scopes.error)} <button className="btn" onClick={() => void scopes.refetch()}>Retry</button></Banner> : null}
    {grant.error || revoke.error ? <Banner kind="crit">{message(grant.error ?? revoke.error)}</Banner> : null}
    {grant.isSuccess || revoke.isSuccess ? <Banner kind="ok">Admin rights updated.</Banner> : null}
    {(scopes.data?.items ?? []).map(row => <div className="spread" key={row.id}><span>{row.user.fullName} | {row.scopeType}{row.facultyId ? ` | Faculty #${row.facultyId}` : ''}</span>
      <button className="btn ghost" disabled={busy || row.user.id === me.data?.id || row.scopeType !== target || !canGrant}
        onClick={() => { revoke.reset(); setRemoving(row) }}>Revoke</button></div>)}
    {scopes.isSuccess && !scopes.data.items.length ? <p>No admin rights in your scope.</p> : null}
    {canGrant ? <><Field label="User ID" htmlFor="grant-user"><input id="grant-user" type="number" min="1" step="1" value={userId} onChange={e => setUserId(e.target.value)} /></Field>
      {target === 'faculty' ? <Field label="Faculty" htmlFor="grant-faculty"><select id="grant-faculty" value={facultyId} onChange={e => setFacultyId(e.target.value)}><option value="">Choose faculty</option>{faculties.data?.items.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field> : null}
      <button className="btn primary" disabled={!valid || busy} onClick={() => { grant.reset(); setReview(true) }}>Review grant</button></> : <p>Faculty admins can view rights in their faculty.</p>}
    <Modal open={review} onClose={() => !busy && setReview(false)} title="Grant admin rights">
      <p>Grant {target} rights to user #{userId}{target === 'faculty' ? ` in Faculty #${facultyId}` : ''}?</p>
      {grant.error ? <Banner kind="crit">{message(grant.error)}</Banner> : null}
      <button className="btn" disabled={busy} onClick={() => setReview(false)}>Cancel</button><button className="btn primary" disabled={busy || !valid} onClick={() => grant.mutate({ userId: Number(userId), scopeType: target, ...(target === 'faculty' ? { facultyId: Number(facultyId) } : {}) }, { onSuccess: () => { setReview(false); setUserId('') } })}>Confirm grant</button>
    </Modal>
    <Modal open={!!removing} onClose={() => !busy && setRemoving(null)} title="Revoke admin rights">
      <p>Remove {removing?.scopeType} rights from {removing?.user.fullName}?</p>
      {revoke.error ? <Banner kind="crit">{message(revoke.error)}</Banner> : null}
      <button className="btn" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button><button className="btn danger" disabled={busy} onClick={() => removing && revoke.mutate(removing.id, { onSuccess: () => setRemoving(null) })}>Confirm revoke</button>
    </Modal>
  </Panel>
}
export function AdminAuditTab() {
  const logs = useAuditLogs({ limit: 100 })
  return <Panel quiet><h3>Audit logs</h3><p>Latest 100 records. Read access requires Root or University Admin rights.</p>
    {logs.isPending ? <p>Loading audit logs...</p> : null}
    {logs.error ? <Banner kind="crit">{message(logs.error)} <button className="btn" onClick={() => void logs.refetch()}>Retry</button></Banner> : null}
    {logs.isSuccess && !logs.data.items.length ? <p>No audit records.</p> : null}
    {logs.data?.items.map(row => <div className="vstack" key={row.id}><b>{row.actionType} | {row.entityType} #{row.entityId}</b><span>{row.user.fullName} | {new Date(row.createdAt).toLocaleString()}</span><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(row.details, null, 2)}</pre></div>)}
  </Panel>
}
