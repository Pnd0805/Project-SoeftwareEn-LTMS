/**
 * src/features/admin/AdminUsersTab.tsx
 *
 * Account management (FR-UM-05): find anyone, suspend an account that broke the
 * rules or reinstate it, and grant or revoke admin rights. A suspended account
 * cannot sign in and cannot be entered in a tournament.
 *
 * ── backend ───────────────────────────────────────────────────────────────
 * ยังไม่มี GET /admin/users, PATCH /admin/users/{id}/suspend และการให้/เพิกถอนสิทธิ์
 * — นอกโหมด mock ได้ 501 · แต่ auth.service ของ backend ปฏิเสธการล็อกอินของบัญชี
 * ที่ถูกระงับอยู่แล้ว (403 ACCOUNT_SUSPENDED)
 *
 * ตัวเองดูจากอีเมลของ useMe — โหมด mock บัญชีเดโมมี id คนละชุดกับ id ในรายชื่อ
 */
import { useState } from 'react'
import { Badge, Banner, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { ConfirmCard, Modal } from '../../components/kit/Modal'
import { useMe } from '../../hooks/useAuth'
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

export function AdminUsersTab() {
  const { data: me } = useMe()
  const users = useUsersForAdmin()
  const suspend = useSuspendUser()
  const grant = useGrantAdminScope()
  const revoke = useRevokeAdminScope()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [limit, setLimit] = useState(PAGE)
  const [suspending, setSuspending] = useState<UserAdminViewDto | null>(null)
  const [reason, setReason] = useState('')
  const [adminChange, setAdminChange] = useState<{ row: UserAdminViewDto; giving: boolean } | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const status = statusOf(users.error)
  const all = users.data?.items ?? []
  const needle = query.trim().toLowerCase()
  const found = all.filter(u => inFilter(u, filter) && (!needle
    || u.user.fullName.toLowerCase().includes(needle)
    || u.email.toLowerCase().includes(needle)
    || (u.facultyName ?? '').toLowerCase().includes(needle)))
  const shown = found.slice(0, limit)
  const busy = suspend.isPending || grant.isPending || revoke.isPending
  const isSelf = (u: UserAdminViewDto) => !!me?.email && me.email.toLowerCase() === u.email.toLowerCase()
  const actionError = grant.error ?? revoke.error ?? (suspending ? null : suspend.error)

  const reinstate = (u: UserAdminViewDto) => {
    setNotice(null)
    suspend.mutate({ userId: u.user.id, input: { suspend: false } }, {
      onSuccess: () => setNotice({ kind: 'ok', text: `${u.user.fullName} can sign in and enter tournaments again.` }),
    })
  }

  const confirmSuspend = () => {
    if (!suspending || !reason.trim()) return
    const target = suspending
    setNotice(null)
    suspend.mutate({ userId: target.user.id, input: { suspend: true, reason: reason.trim() } }, {
      onSuccess: () => {
        setSuspending(null)
        setReason('')
        setNotice({ kind: 'warn', text: `${target.user.fullName} is suspended — they can't sign in or be entered in a tournament.` })
      },
    })
  }

  const confirmAdminChange = () => {
    if (!adminChange) return
    const { row, giving } = adminChange
    setAdminChange(null)
    setNotice(null)
    if (giving) {
      grant.mutate({ userId: row.user.id, scopeType: 'university_wide' }, {
        onSuccess: () => setNotice({ kind: 'ok', text: `${row.user.fullName} is now an admin.` }),
      })
    } else if (row.adminScopes[0]) {
      revoke.mutate(row.adminScopes[0].id, {
        onSuccess: () => setNotice({ kind: 'warn', text: `${row.user.fullName} is no longer an admin.` }),
      })
    }
  }

  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Users · {all.length}</span>
      <div className="sub">
        Find anyone, suspend an account that broke the rules or reinstate it, and grant or revoke admin rights.
        A suspended account cannot sign in and cannot be entered in a tournament.
      </div>

      {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}
      {actionError ? <Banner kind="crit"><b>That change did not go through.</b> {errorMessage(actionError)}</Banner> : null}

      {users.isPending ? <div className="sub">Loading users…</div> : null}
      {users.isError ? (
        status === 501 ? (
          <Banner kind="warn"><b>Not available yet.</b> The backend has no route for listing or suspending users.</Banner>
        ) : status === 401 || status === 403 ? (
          <Banner kind="warn"><b>Account management is for admins.</b> Your account does not have access to it.</Banner>
        ) : (
          <Banner kind="crit">
            <b>Couldn't load the users.</b> {errorMessage(users.error)}{' '}
            <button className="btn" type="button" onClick={() => void users.refetch()}>Try again</button>
          </Banner>
        )
      ) : null}

      {users.isSuccess ? (
        <>
          <div className="hstack" style={{ flexWrap: 'wrap' }}>
            <input value={query} placeholder="Search by name, email or faculty" aria-label="Search users"
              style={{ flex: '1 1 240px' }}
              onChange={e => { setQuery(e.target.value); setLimit(PAGE) }} />
            {FILTERS.map(f => (
              <button key={f.key} type="button" className={`btn ${filter === f.key ? 'primary' : 'ghost'}`}
                onClick={() => { setFilter(f.key); setLimit(PAGE) }}>
                {f.label} · {all.filter(u => inFilter(u, f.key)).length}
              </button>
            ))}
          </div>

          {!found.length ? <div className="sub">Nobody matches that.</div> : (
            <TableWrap>
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
                        <td className="sub">{u.facultyName ?? '—'}</td>
                        <td className="num">{u.teamCount}</td>
                        <td>
                          {admin ? <Badge kind="crit">Admin</Badge>
                            : u.userType === 'external' ? <Badge kind="warn">External</Badge>
                              : <Badge kind="neutral">User</Badge>}
                        </td>
                        <td>
                          {u.isSuspended ? (
                            <span className="vstack" style={{ gap: 2 }}>
                              <Badge kind="crit">Suspended</Badge>
                              {u.suspendedReason ? <span className="sub">{u.suspendedReason}</span> : null}
                            </span>
                          ) : <Badge kind="ok">Active</Badge>}
                        </td>
                        <td>
                          <span className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                            {u.isSuspended ? (
                              <button className="btn ghost" type="button" disabled={busy} onClick={() => reinstate(u)}>
                                Reinstate
                              </button>
                            ) : (
                              <button className="btn ghost" type="button" disabled={busy || self || admin}
                                title={self ? "You can't suspend your own account" : admin ? 'Revoke admin rights first' : undefined}
                                onClick={() => { suspend.reset(); setReason(''); setSuspending(u) }}>
                                Suspend
                              </button>
                            )}
                            {admin ? (
                              <button className="btn ghost" type="button" disabled={busy || self}
                                title={self ? "You can't revoke your own rights" : undefined}
                                onClick={() => { revoke.reset(); setAdminChange({ row: u, giving: false }) }}>
                                Revoke admin
                              </button>
                            ) : (
                              <button className="btn ghost" type="button"
                                disabled={busy || u.isSuspended || u.userType === 'external'}
                                title={u.isSuspended ? 'Reinstate the account first' : u.userType === 'external' ? 'External people cannot be admins' : undefined}
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

      <Modal open={!!suspending} onClose={() => setSuspending(null)} label="Suspend an account"
        title={suspending?.user.fullName ?? ''}>
        <div className="sub">
          They can't sign in while suspended, and they can't be entered in a tournament. Their squads and past
          results stay as they are.
        </div>
        <Field label="Reason — kept with the account" htmlFor="suspend-reason">
          <textarea id="suspend-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        {suspend.isError ? <Banner kind="crit">{errorMessage(suspend.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setSuspending(null)}>Cancel</button>
          <button className="btn danger" type="button" disabled={!reason.trim() || suspend.isPending} onClick={confirmSuspend}>
            {suspend.isPending ? 'Suspending…' : 'Suspend account'}
          </button>
        </div>
      </Modal>

      <Modal open={!!adminChange} onClose={() => setAdminChange(null)}
        label={adminChange?.giving ? 'Grant admin rights' : 'Revoke admin rights'}
        title={adminChange?.row.user.fullName ?? ''}>
        <ConfirmCard danger={!adminChange?.giving} ok={adminChange?.giving ? 'Make admin' : 'Revoke'}
          onCancel={() => setAdminChange(null)}
          body={adminChange?.giving
            ? 'They get university-wide admin rights: every approval queue and account management.'
            : 'They lose admin rights and go back to being a regular user.'}
          onConfirm={confirmAdminChange} />
      </Modal>
    </Panel>
  )
}
