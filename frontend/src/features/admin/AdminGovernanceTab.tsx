import { useSearchUsers } from '../../hooks/useUser'
import { statusLabel, searchUserLabel } from '../../shared/display'
import { useState } from 'react'
import { adminReadBlocked } from './adminView'
import { Badge, Banner, Field, Panel } from '../../components/kit/primitives'
import { useMe } from '../../hooks/useAuth'
import { useAdminScopes, useAuditLogs, useGrantAdminScope, useRevokeAdminScope } from '../../hooks/useAdmin'
import { useFaculties } from '../../hooks/useReference'
import { Modal } from '../../components/kit/Modal'
import { Icon } from '../../components/kit/Icon'
import { Avatar } from '../../components/kit/Avatar'
import type { AdminScopeDto } from '../../types/admin.dto'
import { fmtDateTime } from '../../shared/dateFormat'
import { USE_MOCK } from '../../api/client'
const message = (error: unknown) => error instanceof Error ? error.message : 'Request failed.'
export function AdminScopesTab() {
  const me = useMe(); const scopes = useAdminScopes(); const faculties = useFaculties()
  const grant = useGrantAdminScope(); const revoke = useRevokeAdminScope()
  const [userId, setUserId] = useState(''); const [facultyId, setFacultyId] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const found = useSearchUsers(searchUser, !!me.data?.adminScope)
  const [review, setReview] = useState(false); const [removing, setRemoving] = useState<AdminScopeDto | null>(null)
  const [notice, setNotice] = useState('')
  const actor = me.data?.adminScope?.scopeType
  const target = actor === 'root' ? 'university_wide' : 'faculty'
  const canGrant = actor === 'root' || actor === 'university_wide'
  const valid = Number.isInteger(Number(userId)) && Number(userId) > 0 && (target === 'university_wide' || faculties.data?.items.some(f => f.id === Number(facultyId)))
  const facultyName = (id: number) => faculties.data?.items.find(f => f.id === id)?.name ?? `Faculty #${id}`
  const busy = grant.isPending || revoke.isPending
  const blocked = adminReadBlocked(scopes)
  const rows = blocked ? [] : scopes.data?.items ?? []
  return <Panel quiet className="admin-rights"><h2>Admin rights</h2>
    <p className="sub">{actor === 'root' ? 'Root can grant university rights.' : actor === 'university_wide' ? 'University admins can grant faculty rights.' : actor === 'faculty' ? 'You can view rights in your faculty.' : 'Your scope is not available.'}</p>
    {scopes.isPending ? <p>Loading rights...</p> : null}
    {scopes.error ? <Banner kind="crit">{message(scopes.error)} <button className="btn" onClick={() => void scopes.refetch()}>Retry</button></Banner> : null}
    {grant.error || revoke.error ? <Banner kind="crit">{message(grant.error ?? revoke.error)}</Banner> : null}
    {notice ? <div role="status"><Banner kind="ok">{notice}</Banner></div> : null}
    <div className="admin-rights-list" role="region" aria-label="Admin rights in your scope" tabIndex={0}>
    {rows.map(row => <div className="admin-right-row" key={row.id}><span><b>{row.user.fullName}</b><br /><span className="sub">{row.scopeType.replaceAll('_', ' ')}{row.facultyId ? ` · ${facultyName(row.facultyId)}` : ''}</span></span>
      <button className="btn ghost" disabled={busy || row.user.id === me.data?.id || row.scopeType !== target || !canGrant}
        onClick={() => { revoke.reset(); setRemoving(row) }}>Revoke</button></div>)}
    {scopes.isSuccess && !rows.length ? <p>No admin rights in your scope.</p> : null}
    </div>
    {canGrant && !blocked ? <div className="admin-grant-form"><h3>Grant rights</h3><Field label="Find a user by name" htmlFor="grant-search"><input id="grant-search" type="search" placeholder="At least 3 characters" value={searchUser} onChange={e => setSearchUser(e.target.value)} /></Field>
      {found.isFetching ? <p>Searching users…</p> : null}
      {found.isError ? <Banner kind="crit">{message(found.error)} <button className="btn" onClick={() => void found.refetch()}>Retry search</button></Banner> : null}
      {found.data?.items.map(u => <button className="btn ghost" key={u.id} onClick={() => { setUserId(String(u.id)); setSearchUser(u.fullName) }}>{u.fullName} · {searchUserLabel(u)}</button>)}
      {found.isSuccess && !found.data.items.length ? <p>No matching users.</p> : null}
<Field label="User ID" htmlFor="grant-user"><input id="grant-user" disabled={busy} type="number" min="1" step="1" value={userId} onChange={e => setUserId(e.target.value)} /></Field>
      {target === 'faculty' ? <Field label="Faculty" htmlFor="grant-faculty"><select id="grant-faculty" disabled={busy} value={facultyId} onChange={e => setFacultyId(e.target.value)}><option value="">Choose faculty</option>{faculties.data?.items.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field> : null}
      <button className="btn primary" disabled={!valid || busy} onClick={() => { grant.reset(); setReview(true) }}>Review grant</button></div> : null}
    <Modal className="admin-decision-dialog" open={review && !blocked && canGrant} onClose={() => !busy && setReview(false)} title="Grant admin rights">
      <p>Grant {statusLabel(target)} rights to user #{userId}{target === 'faculty' ? ` in ${facultyName(Number(facultyId))}` : ''}?</p>
      {grant.error ? <Banner kind="crit">{message(grant.error)}</Banner> : null}
      <button className="btn" disabled={busy} onClick={() => setReview(false)}>Cancel</button><button className="btn primary" disabled={busy || !valid} onClick={() => grant.mutate({ userId: Number(userId), scopeType: target, ...(target === 'faculty' ? { facultyId: Number(facultyId) } : {}) }, { onSuccess: () => { setNotice(`Granted ${target.replaceAll('_', ' ')} rights to user #${userId}${target === 'faculty' ? ` in ${facultyName(Number(facultyId))}` : ''}.`); setReview(false); setUserId('') } })}>{grant.isPending ? 'Saving…' : 'Confirm grant'}</button>
    </Modal>
    <Modal className="admin-decision-dialog" open={!!removing && canGrant && rows.some(row => row.id === removing.id && row.scopeType === target && row.user.id !== me.data?.id)} onClose={() => !busy && setRemoving(null)} title="Revoke admin rights">
      <p>Remove {removing ? statusLabel(removing.scopeType) : ''} rights from {removing?.user.fullName}?</p>
      {revoke.error ? <Banner kind="crit">{message(revoke.error)}</Banner> : null}
      <button className="btn" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button><button className="btn danger" disabled={busy} onClick={() => removing && revoke.mutate(removing.id, { onSuccess: () => { setNotice(`Revoked ${removing.scopeType.replaceAll('_', ' ')} rights from ${removing.user.fullName}.`); setRemoving(null) } })}>{revoke.isPending ? 'Saving…' : 'Confirm revoke'}</button>
    </Modal>
  </Panel>
}
const readable = (value: string) => value.replace(/[_.-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const detailValue = (value: unknown): string => value === null ? 'Not specified'
  : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)

export function AdminAuditTab() {
  const me = useMe()
  const scope = me.data?.adminScope?.scopeType
  const canRead = USE_MOCK || scope === 'root' || scope === 'university_wide'
  const [page, setPage] = useState(1)
  const logs = useAuditLogs({ page }, canRead)
  const [search, setSearch] = useState('')
  const [entity, setEntity] = useState('')
  if (!canRead) return <Panel quiet><h3>Audit logs</h3><p>Audit logs are available to Root and University Admin only.</p></Panel>
  const items = adminReadBlocked(logs) ? [] : logs.data?.items ?? []
  const types = [...new Set(items.map(row => row.entityType))].sort()
  const visible = items.filter(row => (!entity || row.entityType === entity) &&
    [row.actionType, readable(row.actionType), row.entityType, String(row.entityId), row.user.fullName, String(row.user.id), JSON.stringify(row.details)]
      .join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <Panel quiet className="admin-audit">
    <div className="spread"><h2>Audit logs</h2>{logs.data && !adminReadBlocked(logs) ? <Badge kind="neutral">{items.length} records loaded</Badge> : null}</div>
    <p className="sub">Browse every page. Search and filters apply to the current page. Read access requires Root or University Admin rights.</p>
    <div className="grid2">
      <Field label="Search audit logs" htmlFor="audit-search"><input id="audit-search" type="search" placeholder="Action, person, entity ID or details" value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <Field label="Entity type" htmlFor="audit-entity"><select id="audit-entity" value={entity} onChange={event => setEntity(event.target.value)}><option value="">All entities</option>{types.map(type => <option key={type} value={type}>{readable(type)}</option>)}</select></Field>
    </div>
    {logs.isPending ? <p>Loading audit logs...</p> : null}
    {logs.error ? <Banner kind="crit">{message(logs.error)} <button className="btn" onClick={() => void logs.refetch()}>Retry</button></Banner> : null}
    {logs.isSuccess && !items.length ? <p>No audit records.</p> : null}
    {logs.isSuccess && items.length > 0 && !visible.length ? <p>No records match these filters.</p> : null}
    <div className="admin-audit-list" role="region" aria-label="Audit records" tabIndex={0}>
      {visible.map(row => <article className="admin-audit-record" key={row.id}>
        <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="hstack"><Icon name="shield" size={20} /><b title={row.actionType}>{readable(row.actionType)}</b></span>
          <Badge kind="neutral">{readable(row.entityType)} #{row.entityId}</Badge>
          {row.details?.selfApproved === true ? <Badge kind="warn">Approved by the requester</Badge> : null}
        </div>
        <div className="hstack" style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          <Avatar name={row.user.fullName} avatarUrl={row.user.avatarUrl} />
          <span><b>{row.user.fullName}</b><br /><span className="sub">User #{row.user.id}</span></span>
          <span className="sub"><Icon name="clock" size={14} /> {fmtDateTime(row.createdAt)}</span>
          <span className="tag">Record #{row.id}</span>
        </div>
        {row.details && Object.keys(row.details).length ? <details style={{ marginTop: 12 }}><summary>View details ({Object.keys(row.details).length})</summary>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {Object.entries(row.details).map(([key, value]) => <div key={key}><dt className="tag">{readable(key)}</dt><dd style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detailValue(value)}</dd></div>)}
          </dl>
        </details> : <p className="sub">No additional details recorded.</p>}
      </article>)}
    </div>
    <div className="hstack"><button className="btn" disabled={page <= 1 || logs.isFetching} onClick={() => setPage(p => p - 1)}>Previous page</button><span>Page {page} of {logs.data?.pagination?.totalPages ?? 1}</span><button className="btn" disabled={!logs.data?.pagination || page >= logs.data.pagination.totalPages || logs.isFetching} onClick={() => setPage(p => p + 1)}>Next page</button></div>
  </Panel>
}
