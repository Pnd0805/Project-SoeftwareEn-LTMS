/**
 * S02b — กรรมการแก้ผลที่ทีมส่งมา (โหมด online เท่านั้น · OD-55 · 4 ต.ค.)
 *
 * ตอนผลยัง `submitted` กรรมการทำได้สองทาง และ backend ยอมทั้งคู่โดยเจตนา: แก้ผล (S02b) เมื่อรู้ว่า
 * ผลที่ถูกคืออะไร · ค้าน (S03) เมื่อไม่รู้ หรือปัญหาไม่ใช่สกอร์ (ผู้เล่นไม่มีสิทธิ์ · สงสัยโกง ·
 * เน็ตหลุดต้องแข่งใหม่) — ถ้ากรรมการกดค้านทั้งที่รู้คำตอบ ผู้จัดต้องมาทำงานโดยไม่จำเป็น
 * จึงวางแก้ผลเป็นทางหลัก และบอกไว้ตรงนี้ว่าเมื่อไหร่ควรใช้ปุ่มค้านแทน
 *
 * แก้แล้วผล **ยังไม่จบ** — กลับไปรอหัวหน้าทีมฝ่ายไหนก็ได้รับรอง หรือ auto-verify
 * ไม่มี endpoint บอกเวลาปิดอัตโนมัติ (24 ชม. หลังส่ง หรือ 15 นาทีก่อนนัดถัดไป) จึงไม่นับถอยหลัง
 */
import { useState } from 'react'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { ApiError } from '../../api/client'
import { useOverrideResult } from '../../hooks/useMatch'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'

const asNumber = (value: unknown) => (typeof value === 'number' ? value : 0)

function overrideError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : ''
  if (code === 'RESULT_NOT_OVERRIDABLE') return 'This result is no longer waiting on confirmation, so it cannot be corrected here. Reload to see where it stands.'
  if (code === 'OVERRIDE_ONSITE_NOT_ALLOWED') return 'Only online matches can be corrected by the referee.'
  if (code === 'WRONG_SUBMITTER_ROLE') return 'Only a referee of this match can correct its result.'
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export function ResultOverride({ m, result }: { m: MatchDto; result: MatchResultDto }) {
  const override = useOverrideResult(m.id, m.tournamentId)
  const [open, setOpen] = useState(false)
  const [a, setA] = useState(() => asNumber(result.scoreData?.a))
  const [b, setB] = useState(() => asNumber(result.scoreData?.b))
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)

  if (!m.teamA || !m.teamB) return null
  const level = a === b
  const winnerTeamId = a > b ? m.teamA.id : m.teamB.id

  if (!open) {
    return (
      <div className="vstack">
        {done ? (
          <Banner kind="ok" icon="check">
            <b>บันทึกเรียบร้อยแล้ว</b> ส่งเรื่องแก้ไขผลการแข่งขันแล้ว (Result edited). It now waits for either team leader to accept it — it is not final yet.
          </Banner>
        ) : null}
        <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
          onClick={() => { setOpen(true); setDone(false) }}>
          Edit result
        </button>
        <span className="sub">
          Use this when you know the right score. If you don&apos;t, or the problem isn&apos;t the score
          (an ineligible player, suspected cheating, a disconnect that needs a replay), use Dispute this
          result instead so the organizer decides.
        </span>
      </div>
    )
  }

  return (
    <Panel>
      <span className="tag"><em>//</em> Edit result</span>
      <div className="grid2" style={{ maxWidth: 420 }}>
        <Field label={m.teamA.name} htmlFor="ov-a">
          <input id="ov-a" type="number" min={0} max={999} value={a} onChange={e => setA(Number(e.target.value))} />
        </Field>
        <Field label={m.teamB.name} htmlFor="ov-b">
          <input id="ov-b" type="number" min={0} max={999} value={b} onChange={e => setB(Number(e.target.value))} />
        </Field>
      </div>
      {level ? <Banner kind="warn"><b>Every match needs a winner.</b> Enter the score with the winning side ahead.</Banner> : null}
      <Field label="Reason — both teams will read this" htmlFor="ov-why">
        <textarea id="ov-why" maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. The real score was 1–3, as recorded in the match room" />
      </Field>
      {override.isError ? <Banner kind="crit"><b>The correction did not go through.</b> {overrideError(override.error)}</Banner> : null}
      <div className="hstack">
        <button className="btn" type="button" disabled={override.isPending} onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn primary" type="button" disabled={override.isPending || level || !reason.trim()}
          onClick={async () => {
            try {
              await override.mutateAsync({ winnerTeamId, scoreData: { a, b }, reason: reason.trim() })
              setOpen(false)
              setReason('')
              setDone(true)
            } catch { /* แสดงจาก override.error ข้างบน */ }
          }}>
          {override.isPending ? 'Saving…' : 'Save edit result'}
        </button>
      </div>
    </Panel>
  )
}
