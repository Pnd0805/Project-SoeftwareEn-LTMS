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
 * ไม่นับเองจากแถว · F14 แสดงคำเตือนกรรมการมีงานนอกทัวร์ทับเวลา
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
import { Avatar } from '../../../components/kit/Avatar'
import { RefereeCoverageWarnings } from './RefereeCoverageWarnings'
import { useState } from 'react'
import { Badge, Banner, Field, Panel, TableWrap } from '../../../components/kit/primitives'
import { ConfirmCard, Modal } from '../../../components/kit/Modal'
import { ApiError, USE_MOCK } from '../../../api/client'
import { useLtms } from '../../../shared/store'
import { numOf } from '../../../mocks/storeBridge'
import { useAppointReferee, useRemoveReferee, useTournamentReferees } from '../../../hooks/useAdmin'
import { useSearchUsers } from '../../../hooks/useUser'
import { useMe } from '../../../hooks/useAuth'
import { refsNeeded } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'
import type { TournamentRefereeDto } from '../../../types/admin.dto'
import { ContractErrorDetails } from '../../../components/kit/ContractErrorDetails'

type Notice = { kind: 'ok' | 'crit'; text: string } | null

function RefereeCandidateRow({
  userId,
  name,
  sub,
  isMockExternal,
  appointPending,
  onAppoint,
}: {
  userId: number
  name: string
  sub: string
  isMockExternal?: boolean
  appointPending: boolean
  onAppoint: (userId: number, isExternal: boolean) => void
}) {
  const isExternal = USE_MOCK ? !!isMockExternal : false
  const affiliationLabel = USE_MOCK ? sub : `${sub} · ระบบกำหนดภายใน/ภายนอกเมื่อส่งคำเชิญ`

  return (
    <tr>
      <td>
        <span className="hstack" style={{ gap: 8, alignItems: 'center' }}>
          <span className="avatar">{name.slice(0, 1)}</span>
          <span>{name}</span>
          {USE_MOCK ? (
            isExternal ? <Badge kind="warn">External</Badge> : <Badge kind="neutral">Internal</Badge>
          ) : null}
        </span>
      </td>
      <td className="sub">{affiliationLabel}</td>
      <td style={{ textAlign: 'right' }}>
        <button
          className="btn primary"
          type="button"
          disabled={appointPending}
          onClick={() => onAppoint(userId, isExternal)}
        >
          Invite to officiate
        </button>
      </td>
    </tr>
  )
}

function RefereeState({ r }: { r: TournamentRefereeDto }) {
  if (r.status === 'expired') return <Badge kind="neutral">Invitation expired — can invite again</Badge>
  if (r.status === 'removed') return <Badge kind="neutral">Removed</Badge>
  if (r.invitationStatus === 'pending') return <Badge kind="warn">Invited — waiting</Badge>
  if (r.invitationStatus !== 'accepted') return <Badge kind="neutral">Declined</Badge>
  if (r.isExternal && r.externalApprovalStatus === 'pending') return <Badge kind="warn">Accepted — waiting for admin approval</Badge>
  if (r.isExternal && r.externalApprovalStatus === 'needs_docs') return <Badge kind="warn">Accepted — additional documents required</Badge>
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

const appointError = (error: unknown) => {
  /* ปกติไม่ควรมาถึงตรงนี้ เพราะรายชื่อตัดตัวผู้จัดออกแล้ว — เหลือไว้เผื่อบัญชีเดียวกันในอีกแท็บ */
  if (error instanceof ApiError && error.code === 'ORGANIZER_CANNOT_BE_REFEREE') {
    return 'You organize this tournament, so you cannot also officiate it.'
  }
  if (error instanceof ApiError && error.code === 'REFEREE_CONFLICT_OF_INTEREST') {
    const teamId = typeof error.extra.teamId === 'number' ? ` (team #${error.extra.teamId})` : ''
    return `This person is already competing in the tournament${teamId}, so they cannot officiate it.`
  }
  return error instanceof Error ? error.message : 'Could not invite this referee.'
}

export function RefereeFinder({ t, open, onClose }: { t: Tournament; open: boolean; onClose: () => void }) {
  const s = useLtms()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const { data: current } = useTournamentReferees(open ? t.id : undefined)
  const appoint = useAppointReferee(t.id)
  const [invitationNotice, setInvitationNotice] = useState<string | null>(null)

  /* คนที่อยู่ในทัวร์นาเมนต์แล้ว (ทั้งตอบรับและรอตอบ) ไม่ควรโผล่ให้เชิญซ้ำ
     บัญชีที่ถูกระงับแต่งตั้งไม่ได้ (FR-UM-05) จึงไม่แสดงเลย */
  const taken = new Set((current?.items ?? []).filter(r =>
    !['expired', 'removed', 'declined', 'rejected_by_admin'].includes(r.status ?? '')
    && r.invitationStatus !== 'rejected').map(r => r.user.id))
  /**
   * ผู้จัดเป็นกรรมการทัวร์ของตัวเองไม่ได้ — spec `02-roles-permissions.md` §7 (ห้ามใช้สิทธิ์
   * ปฏิบัติงานกับเรื่องของตัวเอง) และมติ 18 ก.ย. ที่ F01 บังคับไว้ด้วย `invitee ≠ inviter`
   * (`409 ORGANIZER_CANNOT_BE_REFEREE`) · เดิมผู้จัดค้นเจอชื่อตัวเองแล้วกดเชิญได้ ได้ 409 ดิบกลับมา
   * ซึ่งคือปุ่มที่รู้อยู่แล้วว่าพัง — ตัดออกตั้งแต่รายชื่อ ส่วนคนที่อยู่ในทีมที่สมัครทัวร์นี้ รายชื่อ
   * ค้นหาไม่บอกเรา จึงปล่อยให้ backend ปฏิเสธแล้วอธิบายด้วย `appointError`
   */
  const { data: me } = useMe()
  const found = useSearchUsers(q.trim(), open && !USE_MOCK)
  const storeCands = USE_MOCK
    ? s.users
      .filter(x => x.role !== 'Admin' && !x.suspended && !taken.has(numOf(x.id)))
      .filter(x => needle.length > 1 && x.name.toLowerCase().includes(needle))
      .slice(0, 12)
    : []
  const apiCands = USE_MOCK
    ? []
    : (found.data?.items ?? []).filter(x => !taken.has(x.id) && x.id !== me?.id).slice(0, 12)
  const cands: Array<{ key: string; userId: number; name: string; sub: string; external: boolean }> =
    USE_MOCK
      ? storeCands.map(x => ({
        key: x.id, userId: numOf(x.id), name: x.name,
        sub: x.external ? 'Outside the university' : `${x.faculty} · Year ${x.year}`,
        external: !!x.external,
      }))
      : apiCands.map(x => ({
        key: String(x.id), userId: x.id, name: x.fullName,
        sub: [`Player #${x.id}`, x.facultyName, x.year == null ? null : `Year ${x.year}`].filter(Boolean).join(' · '), external: false,
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
      <div className="sub" style={{ marginBottom: 12 }}>
        ระบบจะตรวจจับสถานะกรรมการ (ภายใน/ภายนอก) ให้อัตโนมัติจากข้อมูลบัญชี โดยกรรมการภายนอกจะต้องรอการอนุมัติจากผู้ดูแลระบบหลังตอบรับคำเชิญ
      </div>
      {!USE_MOCK && found.isFetching ? <div className="sub">Searching…</div> : null}
      {!USE_MOCK && found.isError ? (
        <Banner kind="crit"><b>Search failed.</b> {(found.error as Error).message}</Banner>
      ) : null}
      {appoint.isError ? (
        <Banner kind="crit"><b>เชิญไม่สำเร็จ</b> {appointError(appoint.error)}<ContractErrorDetails error={appoint.error} /></Banner>
      ) : null}
      {invitationNotice ? <Banner kind="ok">{invitationNotice}</Banner> : null}
      {cands.length ? (
        <TableWrap>
          <table>
            <tbody>
              {cands.map(x => (
                <RefereeCandidateRow
                  key={x.key}
                  userId={x.userId}
                  name={x.name}
                  sub={x.sub}
                  isMockExternal={x.external}
                  appointPending={appoint.isPending}
                  onAppoint={(userId, isExternal) => {
                    setInvitationNotice(null)
                    appoint.mutate(USE_MOCK ? { userId, isExternal } : { userId }, { onSuccess: result => setInvitationNotice(
                      (result.isExternal
                        ? 'External — ต้องส่งเอกสารและผ่านการยืนยันตัวตนจากผู้ดูแลก่อนคุมแมตช์. '
                        : 'Internal — ระบบจัดเป็นกรรมการภายใน. ') + (result.crossTournamentWarnings && result.crossTournamentWarnings > 0
                        ? `Invitation sent. This referee has work outside this tournament overlapping ${result.crossTournamentWarnings} offered matches and may not be able to accept them all.`
                        : 'Invitation sent — waiting for the referee to answer.'),
                    ) })
                  }}
                />
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
      {!USE_MOCK ? <RefereeCoverageWarnings tournamentId={Number(t.id)} /> : null}

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
                          <Avatar name={r.user.fullName} avatarUrl={r.user.avatarUrl} />{r.user.fullName}
                          {r.isExternal ? <Badge kind="warn">External</Badge> : <Badge kind="neutral">Internal</Badge>}
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
