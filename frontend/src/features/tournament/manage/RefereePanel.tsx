/**
 * src/features/tournament/manage/RefereePanel.tsx
 *
 * Officiating is not a role and not a granted right — any student can be asked.
 * That makes the candidate list the whole roll, so it is searched, never
 * scrolled: the panel states how the tournament stands, and the modal is where
 * that standing gets changed.
 *
 * ── สัญญาเดียวสำหรับกรรมการระดับทัวร์นาเมนต์ ──────────────────────────────
 * ทั้งการอ่านและการสั่งงานผ่าน hook ของสไลซ์ 4 (`useAdmin.ts`) ซึ่ง path ตรงกับ
 * SDS §S3: POST /tournaments/{id}/referees และ PATCH /referee-assignments/{id}
 * เลิกเรียก `appointReferee`/`removeReferee` จาก `shared/store` โดยตรงแล้ว
 *
 * `useInviteTournamentReferee` ของสไลซ์ 2 ยิง path เดียวกัน — เป็นสัญญาซ้ำที่
 * ต้องเลือกตัวใดตัวหนึ่ง ที่นี่เลือกฝั่งสไลซ์ 4 เพราะมีครบทั้งเชิญ ตอบรับ ถอด
 * และมี coverage (FR-RM-03) ที่สไลซ์ 3 ใช้กั้นการบันทึกสถิติด้วย
 *
 * รายชื่อผู้สมัครยังค้นจาก store เพราะยังไม่มี endpoint ค้นหาผู้ใช้ทั่วไป
 * (SDS มีแค่ GET /users/{id} กับ GET /admin/users ซึ่งเป็นของ Admin)
 */
import { useState } from 'react'
import { Badge, Banner, Field, Panel, TableWrap } from '../../../components/kit/primitives'
import { Modal } from '../../../components/kit/Modal'
import { useLtms } from '../../../shared/store'
import { numOf } from '../../../mocks/storeBridge'
import {
  useAppointReferee, useRefereeCoverage, useRemoveReferee, useTournamentReferees,
} from '../../../hooks/useAdmin'
import type { Tournament } from '../../../shared/types'

export function RefereeFinder({ t, open, onClose }: { t: Tournament; open: boolean; onClose: () => void }) {
  const s = useLtms()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const { data: current } = useTournamentReferees(open ? t.id : undefined)
  const appoint = useAppointReferee(t.id)

  /* คนที่อยู่ในทัวร์นาเมนต์แล้ว (ทั้งตอบรับและรอตอบ) ไม่ควรโผล่ให้เชิญซ้ำ */
  const taken = new Set((current?.items ?? []).map(r => r.user.id))
  const cands = s.users
    .filter(x => x.role !== 'Admin' && !taken.has(numOf(x.id)))
    .filter(x => needle.length > 1 && x.name.toLowerCase().includes(needle))
    .slice(0, 12)

  return (
    <Modal open={open} onClose={onClose}
      label={`Appoint a referee — an ${t.channel} match needs ${t.channel === 'onsite' ? 2 : 1}`}
      title={t.name}>
      <Field label="Search the roll by name" htmlFor="ref-find">
        <input id="ref-find" autoComplete="off" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Start typing a name…" />
      </Field>
      {appoint.isError ? (
        <Banner kind="crit"><b>เชิญไม่สำเร็จ</b> {(appoint.error as Error).message}</Banner>
      ) : null}
      {cands.length ? (
        <TableWrap>
          <table>
            <tbody>
              {cands.map(x => (
                <tr key={x.id}>
                  <td><span className="hstack"><span className="avatar">{x.name.slice(0, 1)}</span>{x.name}</span></td>
                  <td className="sub">{x.faculty} · Year {x.year}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn primary" type="button" disabled={appoint.isPending}
                      onClick={() => appoint.mutate({ userId: numOf(x.id) })}>
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
          {needle.length > 1 ? 'Nobody on the roll matches that.' : 'Type at least two letters — the roll is the whole university.'}
        </div>
      )}
      <div className="hstack"><button className="btn ghost" type="button" onClick={onClose}>Done</button></div>
    </Modal>
  )
}

export function RefereePanel({ t, need, onAppoint }: { t: Tournament; need: number; onAppoint: () => void }) {
  const { data: referees, isPending } = useTournamentReferees(t.id)
  const { data: coverage } = useRefereeCoverage(t.id)
  const remove = useRemoveReferee(t.id)

  const rows = referees?.items ?? []
  /* FR-RM-03 นับเฉพาะคนที่ตอบรับแล้ว — คำเชิญที่ยังไม่ตอบไม่นับ */
  const required = coverage?.required ?? need
  const accepted = coverage?.accepted ?? rows.filter(r => r.invitationStatus === 'accepted').length
  const short = Math.max(0, required - accepted)

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Referees — an {t.channel} match needs {required}</span>
        <Badge kind={short === 0 ? 'ok' : 'warn'}>{`${accepted} of ${required} accepted`}</Badge>
      </div>

      {short > 0 ? (
        <Banner kind="warn">
          <b>{short} more must accept before this can be published.</b>{' '}
          An invitation counts only once it is answered.
        </Banner>
      ) : null}

      {remove.isError ? (
        <Banner kind="crit"><b>ถอดไม่สำเร็จ</b> {(remove.error as Error).message}</Banner>
      ) : null}

      {isPending ? <div className="sub">Loading referees…</div> : null}

      {rows.length ? (
        <TableWrap>
          <table>
            <thead><tr><th>On this tournament</th><th>Faculty</th><th>State</th><th /></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td><span className="hstack"><span className="avatar">{r.user.fullName.slice(0, 1)}</span>{r.user.fullName}</span></td>
                  {/* DTO ของกรรมการยังไม่มีคณะ — ดูโปรไฟล์เอาถ้าต้องการ */}
                  <td className="sub">—</td>
                  <td>{r.invitationStatus === 'accepted'
                    ? <Badge kind="ok">Accepted</Badge>
                    : <Badge kind="warn">Invited — waiting</Badge>}</td>
                  <td>
                    <button className="btn ghost" type="button" disabled={remove.isPending}
                      onClick={() => remove.mutate(r.user.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}

      <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }} onClick={onAppoint}>
        Appoint a referee
      </button>
    </Panel>
  )
}
