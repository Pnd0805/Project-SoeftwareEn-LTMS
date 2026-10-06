/**
 * src/features/admin/AdminUsersTab.tsx
 *
 * Account management (FR-UM-05): find anyone, suspend an account that broke the
 * rules or reinstate it, and grant or revoke admin rights. A suspended account
 * cannot sign in and cannot be entered in a tournament.
 *
 * BE_KN C2: flat user DTOs, scoped rights and suspension category/expiry.
 */
import { USE_MOCK } from '../../api/client'
import { adminReadBlocked } from './adminView'
import { useState } from 'react'
import { Badge, Banner, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useMe } from '../../hooks/useAuth'
import { usePublicUser } from '../../hooks/useUser'
import { useFaculties } from '../../hooks/useReference'
import { useGrantAdminScope, useRevokeAdminScope, useSuspendUser, useUsersForAdmin } from '../../hooks/useAdmin'
import type { UserAdminViewDto } from '../../types/admin.dto'

const PAGE = 40

const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'admins', label: 'Admins' },
  { key: 'external', label: 'External' },
] as const
type FilterKey = typeof FILTERS[number]['key']

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'
const statusOf = (error: unknown) => (error as { status?: number } | null)?.status

const inFilter = (u: UserAdminViewDto, f: FilterKey) =>
  f === 'all'
  || (f === 'suspended' && u.isSuspended)
  || (f === 'admins' && u.adminScopes.length > 0)
  || (f === 'external' && u.userType === 'external')

type Notice = { kind: 'ok' | 'warn'; text: string } | null

/** Only mounted rows load profiles; reuse the public-profile query cache. */
function SquadCount({ row }: { row: UserAdminViewDto }) {
  const profile = usePublicUser(!USE_MOCK && row.teamCount == null ? row.user.id : undefined)
  if (row.teamCount != null) return <>{row.teamCount}</>
  if (USE_MOCK) return <span>Unavailable</span>
  if (profile.isPending) return <span className="sub">Loading...</span>
  if (profile.isError || !Array.isArray(profile.data?.teams)) return <button
    className="btn ghost" type="button" aria-label={`Retry squads for ${row.user.fullName}`}
    title="Could not load this user's squads" onClick={() => void profile.refetch()}>Retry</button>
  return <span title="Current squads">{new Set(profile.data.teams.map(team => team.id)).size}</span>
}

export function AdminUsersTab() {
  const { data: me } = useMe()
  const users = useUsersForAdmin()
  const faculties = useFaculties()
  const facultyName = (u: UserAdminViewDto) => faculties.data?.items.find(f => f.id === u.facultyId)?.name
    ?? u.facultyName ?? (u.facultyId == null ? null : `Faculty #${u.facultyId}`)
  const suspend = useSuspendUser()
  const grant = useGrantAdminScope()
  const revoke = useRevokeAdminScope()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [limit, setLimit] = useState(PAGE)
  const [suspending, setSuspending] = useState<UserAdminViewDto | null>(null)
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState<'abusive_language' | 'cheating' | 'false_information' | 'spam' | 'other'>('other')
  const [days, setDays] = useState('')
  const [adminChange, setAdminChange] = useState<{ row: UserAdminViewDto; giving: boolean } | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const scope = me?.adminScope?.scopeType
  const canGrant = USE_MOCK || scope === 'university_wide'
  const canRevoke = (u: UserAdminViewDto) => USE_MOCK || (scope === 'university_wide' && u.adminScopes[0]?.scopeType === 'faculty')
  const canSuspend = (u: UserAdminViewDto) => USE_MOCK || scope === 'university_wide' || (scope === 'faculty' && !u.adminScopes.length && u.facultyId === me?.adminScope?.facultyId)
  const validDays = days === '' || (Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 90)
  const status = statusOf(users.error)
  const blocked = adminReadBlocked(users)
  const all = blocked ? [] : users.data?.items ?? []
  const needle = query.trim().toLowerCase()
  const found = all.filter(u => inFilter(u, filter) && (!needle
    || u.user.fullName.toLowerCase().includes(needle)
    || u.email.toLowerCase().includes(needle)
    || (facultyName(u) ?? '').toLowerCase().includes(needle)))
  const shown = found.slice(0, limit)
  const busy = suspend.isPending || grant.isPending || revoke.isPending
  const isSelf = (u: UserAdminViewDto) => !!me?.email && me.email.toLowerCase() === u.email.toLowerCase()
  const suspensionTarget = all.find(row => row.user.id === suspending?.user.id)
  const adminTarget = all.find(row => row.user.id === adminChange?.row.user.id)
  const maySuspend = !!suspensionTarget && canSuspend(suspensionTarget) && !isSelf(suspensionTarget) && !suspensionTarget.isSuspended
  const mayChangeAdmin = !!adminTarget && (adminChange?.giving
    ? canGrant && !adminTarget.isSuspended && (USE_MOCK || !!adminTarget.facultyId)
    : canRevoke(adminTarget) && !isSelf(adminTarget))
  const actionError = grant.error ?? revoke.error ?? (suspending ? null : suspend.error)

  const reinstate = (u: UserAdminViewDto) => {
    setNotice(null)
    suspend.mutate({ userId: u.user.id, input: { suspend: false } }, {
      onSuccess: () => setNotice({ kind: 'ok', text: `${u.user.fullName} can sign in and enter tournaments again.` }),
    })
  }

  const confirmSuspend = () => {
    if (!suspending || !maySuspend || busy || !reason.trim() || !validDays) return
    const target = suspending
    setNotice(null)
    suspend.mutate({ userId: target.user.id, input: { suspend: true, reason: reason.trim(), category, days: days === '' ? undefined : Number(days) } }, {
      onSuccess: () => {
        setSuspending(null)
        setReason('')
        setNotice({ kind: 'warn', text: `${target.user.fullName} is suspended — they can't sign in or be entered in a tournament.` })
      },
    })
  }

  const confirmAdminChange = () => {
    if (!adminChange || !adminTarget || !mayChangeAdmin || busy || blocked) return
    const row = adminTarget
    const { giving } = adminChange
    setNotice(null)
    if (giving) {
      grant.mutate({ userId: row.user.id, scopeType: USE_MOCK ? 'university_wide' : 'faculty', facultyId: USE_MOCK ? undefined : row.facultyId ?? undefined }, {
        onSuccess: () => { setAdminChange(null); setNotice({ kind: 'ok', text: `${row.user.fullName} is now an admin.` }) },
      })
    } else if (row.adminScopes[0]) {
      revoke.mutate(row.adminScopes[0].id, {
        onSuccess: () => { setAdminChange(null); setNotice({ kind: 'warn', text: `${row.user.fullName} is no longer an admin.` }) },
      })
    }
  }

  return (
    <Panel quiet className="admin-users">
      <h2>Users</h2>
      <div className="sub">
        Find anyone, suspend an account that broke the rules or reinstate it, and grant or revoke admin rights.
        A suspended account cannot sign in and cannot be entered in a tournament.
      </div>

      {notice ? <div role="status"><Banner kind={notice.kind}>{notice.text}</Banner></div> : null}
      {actionError ? <Banner kind="crit"><b>That change did not go through.</b> {errorMessage(actionError)}</Banner> : null}

      {faculties.isError ? <Banner kind="warn">
        Could not load faculty names. Faculty IDs are shown until the list is available.
        <button className="btn" type="button" onClick={() => void faculties.refetch()}>Retry faculty names</button>
      </Banner> : null}
      {users.isPending ? <div className="sub">Loading users…</div> : null}
      {users.isError ? (
        status === 501 ? (
          <Banner kind="warn"><b>Account management unavailable.</b> User listing and account changes are not available yet.</Banner>
        ) : status === 401 || status === 403 ? (
          <Banner kind="warn"><b>Account management is for admins.</b> Your account does not have access to it.</Banner>
        ) : (
          <Banner kind="crit">
            <b>Couldn't load the users.</b> {errorMessage(users.error)}{' '}
            <button className="btn" type="button" onClick={() => void users.refetch()}>Try again</button>
          </Banner>
        )
      ) : null}

      {!blocked && (users.isSuccess || !!users.data) ? (
        <>
          <div className="admin-user-toolbar">
            <input type="search" value={query} placeholder="Name, email or faculty" aria-label="Search users"
              style={{ flex: '1 1 240px' }}
              onChange={e => { setQuery(e.target.value); setLimit(PAGE) }} />
            {FILTERS.map(f => (
              <button key={f.key} type="button" className={`btn ${filter === f.key ? 'primary' : 'ghost'}`}
                aria-pressed={filter === f.key}
                onClick={() => { setFilter(f.key); setLimit(PAGE) }}>
                {f.label} · {all.filter(u => inFilter(u, f.key)).length}
              </button>
            ))}
          </div>

          {!found.length ? <div className="sub">Nobody matches that.</div> : (
            <TableWrap label="Admin user directory">
              <table>
                <thead><tr><th>Name</th><th>Faculty</th><th>Squads</th><th>Role</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {shown.map(u => {
                    const admin = u.adminScopes.length > 0
                    const self = isSelf(u)
                    return (
                      <tr key={u.user.id}>
                        <td>
                          <span className="vstack" style={{ gap: 2 }}>
                            <span>{u.user.fullName}{self ? <span className="tag"> · you</span> : null}</span>
                            <span className="sub">{u.email}</span>
                          </span>
                        </td>
                        <td className="sub">{facultyName(u) ?? '—'}</td>
                        <td className="num"><SquadCount row={u} /></td>
                        <td>
                          {admin ? <Badge kind="crit">Admin</Badge>
                            : u.userType === 'external' ? <Badge kind="warn">External</Badge>
                              : <Badge kind="neutral">User</Badge>}
                        </td>
                        <td>
                          {u.isSuspended ? (
                            <span className="vstack" style={{ gap: 2 }}>
                              <Badge kind="crit">Suspended</Badge>
                              {u.suspendedUntil ? <span className="sub">Until {new Date(u.suspendedUntil).toLocaleString()}</span> : <span className="sub">Permanent</span>}
                              {u.suspendedCategoryLabel ? <span className="sub">{u.suspendedCategoryLabel}</span> : null}
                              {u.suspendedReason ? <span className="sub">{u.suspendedReason}</span> : null}
                            </span>
                          ) : <Badge kind="ok">Active</Badge>}
                        </td>
                        <td>
                          <span className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                            {u.isSuspended ? (
                              <button className="btn ghost" type="button" disabled={busy || self || !canSuspend(u)} onClick={() => reinstate(u)}>
                                Reinstate
                              </button>
                            ) : (
                              <button className="btn ghost" type="button" disabled={busy || self || !canSuspend(u)}
                                title={self ? "You can't suspend your own account" : !canSuspend(u) ? 'Outside your admin scope' : undefined}
                                onClick={() => { suspend.reset(); setReason(''); setDays(''); setCategory('other'); setSuspending(u) }}>
                                Suspend
                              </button>
                            )}
                            {admin ? (
                              <button className="btn ghost" type="button" disabled={busy || self || !canRevoke(u)}
                                title={self ? "You can't revoke your own rights" : undefined}
                                onClick={() => { revoke.reset(); setAdminChange({ row: u, giving: false }) }}>
                                Revoke admin
                              </button>
                            ) : (
                              <button className="btn ghost" type="button"
                                disabled={busy || !canGrant || u.isSuspended || (!USE_MOCK && !u.facultyId)}
                                title={u.isSuspended ? 'Reinstate the account first' : !canGrant ? 'University Admin rights required' : !u.facultyId && !USE_MOCK ? 'A faculty is required' : undefined}
                                onClick={() => { grant.reset(); setAdminChange({ row: u, giving: true }) }}>
                                Make admin
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}

          {found.length > shown.length ? (
            <button className="btn ghost" type="button" style={{ alignSelf: 'flex-start' }}
              onClick={() => setLimit(l => l + PAGE)}>
              Show {Math.min(PAGE, found.length - shown.length)} more of {found.length - shown.length}
            </button>
          ) : found.length ? <span className="sub">Showing all {found.length}.</span> : null}
        </>
      ) : null}

      <Modal className="admin-decision-dialog" open={!!suspending && maySuspend} onClose={() => { if (!busy) setSuspending(null) }} label="Suspend an account"
        title={suspending?.user.fullName ?? ''}>
        <div className="sub">
          They can't sign in while suspended, and they can't be entered in a tournament. Their squads and past
          results stay as they are.
        </div>
        <Field label="Reason — kept with the account" htmlFor="suspend-reason">
          <textarea id="suspend-reason" rows={3} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        <Field label="Category shown to the account holder" htmlFor="suspend-category">
          <select id="suspend-category" disabled={busy} value={category} onChange={e => setCategory(e.target.value as typeof category)}>
            <option value="abusive_language">Abusive language or harassment</option><option value="cheating">Cheating</option>
            <option value="false_information">False information or impersonation</option><option value="spam">Spam</option><option value="other">Other rule violation</option>
          </select>
        </Field>
        <Field label="Days (1-90); leave blank for permanent suspension" htmlFor="suspend-days">
          <input id="suspend-days" disabled={busy} type="number" min="1" max="90" step="1" value={days} onChange={e => setDays(e.target.value)} />
        </Field>
        {suspend.isError ? <Banner kind="crit">{errorMessage(suspend.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" disabled={busy} onClick={() => setSuspending(null)}>Cancel</button>
          <button className="btn danger" type="button" disabled={!reason.trim() || !validDays || suspend.isPending} onClick={confirmSuspend}>
            {suspend.isPending ? 'Suspending…' : 'Suspend account'}
          </button>
        </div>
      </Modal>

      <Modal className="admin-decision-dialog" open={!!adminChange && mayChangeAdmin} onClose={() => { if (!busy) setAdminChange(null) }}
        label={adminChange?.giving ? 'Grant admin rights' : 'Revoke admin rights'}
        title={adminChange?.row.user.fullName ?? ''}>
        <p className="sub">{adminChange?.giving
            ? USE_MOCK ? 'They get university-wide admin rights.' : `They get faculty admin rights for ${facultyName(adminChange.row)}.`
            : 'They lose admin rights and go back to being a regular user.'}</p>
        {grant.error || revoke.error ? <Banner kind="crit">{errorMessage(grant.error ?? revoke.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" disabled={busy} onClick={() => setAdminChange(null)}>Cancel</button>
          <button className={`btn ${adminChange?.giving ? 'primary' : 'danger'}`} type="button" disabled={busy} onClick={confirmAdminChange}>{busy ? 'Saving…' : adminChange?.giving ? 'Make admin' : 'Revoke'}</button>
        </div>
      </Modal>
    </Panel>
  )
}
