/**
 * src/features/tournament/manage/RefereePanel.tsx
 *
 * Officiating is not a role and not a granted right — any student can be asked.
 * That makes the candidate list the whole roll, so it is searched, never
 * scrolled: the panel states how the tournament stands, and the modal is where
 * that standing gets changed.
 *
 * ── สัญญากับ backend (origin/backend F01–F06) ─────────────────────────────
 * เชิญ: POST /tournaments/:id/referees { userId, isExternal } · รายชื่อ: GET /tournaments/:id/referees
 * ตอบรับ/ปฏิเสธ: POST /referee-invitations/:id/accept | /decline
 *
 * ตาม FEAT-1-REMAINING (Priority 2) ยอดที่ตอบรับแล้วใช้ `acceptedCount` จาก backend
 * ไม่นับเองจากแถว · referee coverage ยังไม่มี endpoint จึงไม่เรียก
 *
 * ── เพิ่มและถอดได้ทุกเมื่อ ────────────────────────────────────────────────
 * ผู้จัดแต่งตั้งและถอดกรรมการได้ตลอด ทั้งก่อนเปิดรับและระหว่างแข่ง (ทีมกำหนด 13 ก.ย. 2026)
 * ถอดด้วย DELETE /tournaments/:id/referees/:rid (api/admin.ts หา rid จากรายชื่อให้ก่อน)
 *
 * ── บุคคลภายนอก (FR-RM-02) ────────────────────────────────────────────────
 * ตอบรับแล้วยังไม่นับจนกว่า Admin จะอนุมัติ แถวจึงมีสถานะแยกให้ผู้จัดเห็นว่ารออะไรอยู่
 *
 * ── ค้นรายชื่อ ────────────────────────────────────────────────────────────
 * โหมดจริงค้นจาก GET /users/search (ชื่อไทย ชื่ออังกฤษ หรือชื่อหน้าอีเมลก็ได้)
 * ⚠️ เดิมค้นจาก `s.users` ของ store ทั้งสองโหมด ซึ่งโหมดจริงไม่มีใครอยู่ในนั้นเลย
 *    ผู้จัดพิมพ์ชื่อคนที่มีตัวตนจริงแล้วขึ้น "ไม่มีชื่อในระบบ" ตลอด เชิญกรรมการไม่ได้
 *    (คอมเมนต์เดิมบอกว่ายังไม่มี endpoint ค้นหา — ไม่จริงแล้ว มีและใช้ได้)
 */
import { useState } from 'react'
import { Badge, Banner, Field, Panel, TableWrap } from '../../../components/kit/primitives'
import { ConfirmCard, Modal } from '../../../components/kit/Modal'
import { USE_MOCK } from '../../../api/client'
import { useLtms } from '../../../shared/store'
import { numOf } from '../../../mocks/storeBridge'
import { useAppointReferee, useRemoveReferee, useTournamentReferees } from '../../../hooks/useAdmin'
import { useSearchUsers } from '../../../hooks/useUser'
import { refsNeeded } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'
import type { TournamentRefereeDto } from '../../../types/admin.dto'

type Notice = { kind: 'ok' | 'crit'; text: string } | null

function RefereeState({ r }: { r: TournamentRefereeDto }) {
  if (r.invitationStatus === 'pending') return <Badge kind="warn">Invited — waiting</Badge>
  if (r.invitationStatus !== 'accepted') return <Badge kind="neutral">Declined</Badge>
  if (r.isExternal && r.externalApprovalStatus === 'pending') return <Badge kind="warn">Accepted — waiting for admin approval</Badge>
  if (r.isExternal && r.externalApprovalStatus === 'rejected') return <Badge kind="crit">Not approved by an admin</Badge>
  return <Badge kind="ok">Accepted</Badge>
}

const removeLabel = (r: TournamentRefereeDto) => (r.invitationStatus === 'pending' ? 'Withdraw invitation' : 'Remove')

const removeError = (error: unknown) => {
  const status = (error as { status?: number } | null)?.status
  if (status === 403) return "Only this tournament's organizer can remove its referees."
  if (status === 501) return "Removing a referee isn't available on the server yet."
  return error instanceof Error ? error.message : 'Could not remove this referee.'
}

export function RefereeFinder({ t, open, onClose }: { t: Tournament; open: boolean; onClose: () => void }) {
  const s = useLtms()
  const [q, setQ] = useState('')
  /* คนนอกมหาวิทยาลัยต้องให้ผู้จัดติ๊กเอง — /users/search ไม่ได้บอกมา และ
     `is_external` เป็นของ "คำเชิญใบนี้" ไม่ใช่คุณสมบัติติดตัวคน */
  const [external, setExternal] = useState(false)
  const needle = q.trim().toLowerCase()
  const { data: current } = useTournamentReferees(open ? t.id : undefined)
  const appoint = useAppointReferee(t.id)

  /* คนที่อยู่ในทัวร์นาเมนต์แล้ว (ทั้งตอบรับและรอตอบ) ไม่ควรโผล่ให้เชิญซ้ำ
     บัญชีที่ถูกระงับแต่งตั้งไม่ได้ (FR-UM-05) จึงไม่แสดงเลย */
  const taken = new Set((current?.items ?? []).map(r => r.user.id))
  const found = useSearchUsers(q.trim(), open && !USE_MOCK)
  const storeCands = USE_MOCK
    ? s.users
      .filter(x => x.role !== 'Admin' && !x.suspended && !taken.has(numOf(x.id)))
      .filter(x => needle.length > 1 && x.name.toLowerCase().includes(needle))
      .slice(0, 12)
    : []
  const apiCands = USE_MOCK
    ? []
    : (found.data?.items ?? []).filter(x => !taken.has(x.id)).slice(0, 12)
  const cands: Array<{ key: string; userId: number; name: string; sub: string; external: boolean }> =
    USE_MOCK
      ? storeCands.map(x => ({
        key: x.id, userId: numOf(x.id), name: x.name,
        sub: x.external ? 'Outside the university' : `${x.faculty} · Year ${x.year}`,
        external: !!x.external,
      }))
      : apiCands.map(x => ({
        key: String(x.id), userId: x.id, name: x.fullName,
        sub: `Account #${x.id}`, external,
      }))
  /* backend เริ่มค้นที่ 3 ตัวอักษร ส่วน store ใช้ 2 — บอกผู้ใช้ตามของจริง */
  const minChars = USE_MOCK ? 2 : 3

  return (
    <Modal open={open} onClose={onClose}
      label={`Appoint a referee — an ${t.channel} match needs ${t.channel === 'onsite' ? 2 : 1}`}
      title={t.name}>
      <Field label={USE_MOCK ? 'Search the roll by name' : 'Search by name or email'} htmlFor="ref-find">
        <input id="ref-find" autoComplete="off" value={q} onChange={e => setQ(e.target.value)}
          placeholder={USE_MOCK ? 'Start typing a name…' : 'Name in Thai or English, or the start of an email…'} />
      </Field>
      {USE_MOCK ? (
        <div className="sub">People from outside the university are marked External — an admin has to approve them after they accept.</div>
      ) : (
        <label className="hstack" style={{ gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={external} onChange={e => setExternal(e.target.checked)} />
          <span>They are from outside the university — an admin has to approve them after they accept.</span>
        </label>
      )}
      {!USE_MOCK && found.isFetching ? <div className="sub">Searching…</div> : null}
      {!USE_MOCK && found.isError ? (
        <Banner kind="crit"><b>Search failed.</b> {(found.error as Error).message}</Banner>
      ) : null}
      {appoint.isError ? (
        <Banner kind="crit"><b>เชิญไม่สำเร็จ</b> {(appoint.error as Error).message}</Banner>
      ) : null}
      {cands.length ? (
        <TableWrap>
          <table>
            <tbody>
              {cands.map(x => (
                <tr key={x.key}>
                  <td>
                    <span className="hstack">
                      <span className="avatar">{x.name.slice(0, 1)}</span>{x.name}
                      {x.external ? <Badge kind="warn">External</Badge> : null}
                    </span>
                  </td>
                  <td className="sub">{x.sub}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn primary" type="button" disabled={appoint.isPending}
                      onClick={() => appoint.mutate({ userId: x.userId, isExternal: x.external })}>
                      Invite to officiate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <div className="sub">
          {needle.length >= minChars
            ? (!USE_MOCK && found.isFetching ? 'Searching…' : 'Nobody matches that.')
            : `Type at least ${minChars} letters — anybody with an account can be asked to officiate.`}
        </div>
      )}
      <div className="hstack"><button className="btn ghost" type="button" onClick={onClose}>Done</button></div>
    </Modal>
  )
}

export function RefereePanel({ t, onAppoint }: { t: Tournament; onAppoint: () => void }) {
  const { data: referees, isPending, isError, error, refetch } = useTournamentReferees(t.id)
  const remove = useRemoveReferee(t.id)
  const [removing, setRemoving] = useState<TournamentRefereeDto | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const rows = referees?.items ?? []
  /* จำนวนที่ต้องมีเป็นกฎของรูปแบบการแข่ง (on-site 2 · online 1) ส่วนจำนวนที่ตอบรับแล้ว
     ใช้ acceptedCount ที่ backend นับให้ */
  const required = refsNeeded(t)
  const accepted = referees?.acceptedCount ?? 0
  const short = Math.max(0, required - accepted)
  const status = (error as { status?: number } | null)?.status
  /* เลิกกรองแถวเอง — A3 ให้ backend นับมาแล้ว และการนับเองพังทันทีที่รายการยาวจนแบ่งหน้า */
  const awaitingAdmin = referees?.awaitingAdminCount ?? 0
  const leaves = removing?.isActive ? accepted - 1 : accepted

  const confirmRemove = () => {
    const r = removing
    if (!r) return
    setRemoving(null)
    setNotice(null)
    remove.mutate(r.user.id, {
      onSuccess: () => setNotice({
        kind: 'ok',
        text: r.invitationStatus === 'pending'
          ? `The invitation to ${r.user.fullName} is withdrawn.`
          : `${r.user.fullName} no longer officiates ${t.name}. You can appoint them again at any time.`,
      }),
      onError: e => setNotice({ kind: 'crit', text: removeError(e) }),
    })
  }

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Referees — an {t.channel} match needs {required}</span>
        {referees ? <Badge kind={short === 0 ? 'ok' : 'warn'}>{`${accepted} of ${required} accepted`}</Badge> : null}
      </div>
      <span className="sub">Appoint or remove referees at any time — before the tournament opens or while it is being played.</span>

      {isPending ? <div className="sub">Loading referees…</div> : null}

      {isError ? (
        status === 401 || status === 403 ? (
          <Banner kind="warn">
            <b>You can't view this tournament's referees.</b> Only its organizer can see the referee list.
          </Banner>
        ) : (
          <Banner kind="crit">
            <span className="grow"><b>Couldn't load the referees.</b> {(error as Error).message}</span>
            <button className="btn" type="button" onClick={() => void refetch()}>Try again</button>
          </Banner>
        )
      ) : null}

      {referees && short > 0 ? (
        <Banner kind="warn">
          <b>{t.status === 'public'
            ? `${short} more must accept — every match needs ${required}.`
            : `${short} more must accept before this can be published.`}</b>{' '}
          An invitation counts only once it is answered{awaitingAdmin ? `, and ${awaitingAdmin} external referee${awaitingAdmin === 1 ? ' is' : 's are'} still waiting for an admin` : ''}.
        </Banner>
      ) : null}

      {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}

      {referees && !rows.length ? <div className="sub">No referees invited yet.</div> : null}

      {rows.length ? (
        <>
          <TableWrap>
            <table>
              <thead><tr><th>On this tournament</th><th>State</th><th /></tr></thead>
              <tbody>
                {rows.map(r => {
                  const busy = remove.isPending && remove.variables === r.user.id
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="hstack">
                          <span className="avatar">{r.user.fullName.slice(0, 1)}</span>{r.user.fullName}
                          {r.isExternal ? <span className="tag"> · external</span> : null}
                        </span>
                      </td>
                      <td><RefereeState r={r} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn ghost" type="button" disabled={busy}
                          onClick={() => { setNotice(null); setRemoving(r) }}>
                          {busy ? 'Removing…' : removeLabel(r)}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : null}

      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }} onClick={onAppoint}>
        Appoint a referee
      </button>

      <Modal open={!!removing} onClose={() => setRemoving(null)}
        label={removing?.invitationStatus === 'pending' ? 'Withdraw an invitation' : 'Remove a referee'}
        title={removing?.user.fullName}>
        <ConfirmCard
          danger
          ok={removing?.invitationStatus === 'pending' ? 'Withdraw invitation' : 'Remove referee'}
          body={removing?.invitationStatus === 'pending'
            ? 'The invitation disappears from their inbox. You can invite them again at any time.'
            : removing?.isActive
              ? <>
                They stop officiating {t.name} straight away and come off every match that isn't finished —
                assign someone else to those. Finished matches keep their name.
                {leaves < required ? <> This leaves {leaves} of {required} accepted referees.</> : null}
              </>
              : 'They have not started officiating yet. Their appointment is cancelled, along with any request waiting for an admin.'}
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      </Modal>
    </Panel>
  )
}
