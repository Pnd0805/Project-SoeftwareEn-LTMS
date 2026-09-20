/**
 * src/features/tournament/manage/EntryRulesPanel.tsx
 *
 * The hard filter as the server actually holds it — คณะ ชั้นปี เพศ อายุ
 *
 * โหมด mock ใช้ `EntryFilterPanel` ตัวเดิมที่อ่าน/เขียน store ส่วนหน้านี้คือของจริง:
 * อ่านจาก `GET /tournaments/:id/eligibility-rules` + รายละเอียดทัวร์ และเขียนผ่าน
 * คำขอแก้ไข (C09) ซึ่งต้องให้แอดมินอนุมัติอีกทีตามดีไซน์ของฟีเจอร์นี้
 *
 * ── สามด่านที่ backend กั้นไว้ และหน้านี้ต้องพูดถึงให้ครบ ────────────────────
 * 1. ทัวร์ที่ยังรออนุมัติแก้ตรงได้ด้วย C17b — แต่เปิดหน้านี้ไม่ได้อยู่ดี เพราะ
 *    `GET /tournaments/:id` ตอบ 404 ให้เจ้าของจนกว่าจะอนุมัติ (ดู BACKEND-GAPS)
 * 2. อนุมัติแล้วต้องไป C09 · ตรงนี้ทำ
 * 3. เปิดรับสมัครหรือมีทีมสมัครแล้ว = ล็อก (409 ELIGIBILITY_LOCKED) เพราะทีมที่
 *    ผ่านตัวกรองไปแล้วจะกลายเป็นผิดกฎย้อนหลัง
 */
import { useState } from 'react'
import { Badge, Banner, Facts, Field, Panel } from '../../../components/kit/primitives'
import { Icon } from '../../../components/kit/Icon'
import { Modal } from '../../../components/kit/Modal'
import { useEligibilityRules, useRequestFilterChange, useTournament } from '../../../hooks/useTournament'
import { useFaculties } from '../../../hooks/useReference'
import { toEligibilityRules } from '../../../schemas/tournament.schema'
import { GenderRequirementLabel, GenderRequirementOptions } from '../../../types/enums'
import type { GenderRequirement } from '../../../types/enums'
import type { Tournament } from '../../../shared/types'

const YEARS = [1, 2, 3, 4, 5, 6, 7, 8]
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'
const toggle = (list: number[], value: number) =>
  list.includes(value) ? list.filter(x => x !== value) : [...list, value].sort((a, b) => a - b)

export function EntryRulesPanel({ t }: { t: Tournament }) {
  const tournamentId = Number(t.id)
  /* ทั้งสองคำขอนี้หน้าทัวร์นาเมนต์ดึงไปแล้ว — อ่านซ้ำได้จากแคช ไม่ได้ยิงเพิ่ม */
  const detail = useTournament(tournamentId)
  const rules = useEligibilityRules(tournamentId)
  const faculties = useFaculties()
  const requestChange = useRequestFilterChange(tournamentId)

  const currentFaculties = (rules.data?.items ?? []).filter(r => r.ruleType === 'faculty').map(r => r.ruleValue)
  const currentYears = (rules.data?.items ?? []).filter(r => r.ruleType === 'year').map(r => r.ruleValue)
  const facultyName = (id: number) => (faculties.data?.items ?? []).find(f => f.id === id)?.name ?? `คณะ #${id}`

  const [open, setOpen] = useState(false)
  const [sentAt, setSentAt] = useState<string | null>(null)
  const [draftFaculties, setDraftFaculties] = useState<number[]>([])
  const [draftYears, setDraftYears] = useState<number[]>([])
  const [gender, setGender] = useState<GenderRequirement>('any')
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')

  const registrationOpen = detail.data?.registrationOpen ?? false
  const organizingFacultyId = detail.data?.organizingFacultyId ?? null

  const startEditing = () => {
    requestChange.reset()
    setDraftFaculties(currentFaculties)
    setDraftYears(currentYears)
    setGender(detail.data?.genderRequirement ?? 'any')
    setMinAge(detail.data?.minAge == null ? '' : String(detail.data.minAge))
    setMaxAge(detail.data?.maxAge == null ? '' : String(detail.data.maxAge))
    setOpen(true)
  }

  /* กติกาเดียวกับ adminCoversEligibility ของ backend — คนตัดสินเปลี่ยนตามจำนวนคณะ */
  const goesToFacultyAdmin = draftFaculties.length === 1
    && organizingFacultyId != null
    && draftFaculties[0] === organizingFacultyId

  const send = () => requestChange.mutate(
    {
      rules: null,
      reason: '',
      changes: {
        eligibilityRules: toEligibilityRules(draftFaculties, draftYears),
        genderRequirement: gender,
        minAge: minAge === '' ? null : Number(minAge),
        maxAge: maxAge === '' ? null : Number(maxAge),
      },
    },
    { onSuccess: () => { setOpen(false); setSentAt(new Date().toLocaleString()) } },
  )

  return (
    <>
      <div className="vstack" style={{ gap: 8 }}>
        <Panel quiet>
          <div className="who">
            <span className="avatar" style={{ background: 'var(--teal)' }}><Icon name="bell" size={13} /></span>
            <span className="meta">
              <b>Soft filter</b>
              <span className="tag">Entry notes — the system shows them, it never checks them</span>
            </span>
          </div>
          {/* FR-TN-03 ยังไม่มีคอลัมน์และไม่มีเส้นทาง — เขียนช่องให้กรอกก็เท่ากับหลอก */}
          <div className="sub">
            Entry notes are not on the server yet, so there is nowhere to publish them. Put anything
            applicants must know in the tournament announcements instead.
          </div>
        </Panel>

        <Panel quiet>
          <div className="who">
            <span className="avatar" style={{ background: 'var(--red)' }}><Icon name="shield" size={13} /></span>
            <span className="meta">
              <b>Hard filter</b>
              <span className="tag">Checked against every player on the squad list, with no override</span>
            </span>
            {registrationOpen ? <Badge kind="warn">Locked</Badge> : null}
          </div>

          <Facts rows={[
            ['Faculties', currentFaculties.length ? currentFaculties.map(facultyName).join(' · ') : 'Every faculty'],
            ['Years of study', currentYears.length ? currentYears.map(y => `Year ${y}`).join(' · ') : 'Every year'],
            ['Gender', GenderRequirementLabel[detail.data?.genderRequirement ?? 'any']],
            ['Age', detail.data?.minAge == null && detail.data?.maxAge == null
              ? 'Any age'
              : `${detail.data?.minAge ?? '—'} to ${detail.data?.maxAge ?? '—'}`],
          ]} />

          {rules.isError ? (
            <Banner kind="crit"><b>Couldn&apos;t read the conditions.</b> {errorMessage(rules.error)}</Banner>
          ) : null}

          {sentAt ? (
            <Banner kind="ok" icon="check">
              <b>Sent to an admin on {sentAt}.</b> The conditions above stay as they are until the
              request is approved. There is no queue you can watch — the admin&apos;s decision arrives
              as a change to this tournament.
            </Banner>
          ) : null}

          {registrationOpen ? (
            <Banner kind="warn" icon="clock">
              <b>Entry is open, so the conditions are frozen.</b> Squads have already been checked
              against them; changing them now would put a squad that passed in breach after the fact.
            </Banner>
          ) : (
            <button className="btn ghost" type="button" style={{ alignSelf: 'flex-start' }} onClick={startEditing}>
              <Icon name="plus" size={14} /> Request a change
            </button>
          )}
        </Panel>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} label="Request a change to the entry conditions" title={t.name}>
        <div className="sub">
          These were approved with the tournament, so an admin has to approve the change too. Nothing
          moves until they do.
        </div>

        <span className="tag"><em>//</em> Faculties — tick none to open it to every faculty</span>
        <div className="grid2">
          {(faculties.data?.items ?? []).map(f => (
            <label key={f.id} className="hstack" style={{ gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={draftFaculties.includes(f.id)}
                onChange={() => setDraftFaculties(list => toggle(list, f.id))} />
              <span>{f.name}</span>
            </label>
          ))}
        </div>

        <span className="tag"><em>//</em> Years of study — tick none to accept every year</span>
        <div className="hstack" style={{ flexWrap: 'wrap', gap: 14 }}>
          {YEARS.map(y => (
            <label key={y} className="hstack" style={{ gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={draftYears.includes(y)}
                onChange={() => setDraftYears(list => toggle(list, y))} />
              <span>Year {y}</span>
            </label>
          ))}
        </div>

        <div className="grid2">
          <Field label="Gender" htmlFor="er-gender">
            <select id="er-gender" value={gender} onChange={e => setGender(e.target.value as GenderRequirement)}>
              {GenderRequirementOptions.map(x => <option key={x} value={x}>{GenderRequirementLabel[x]}</option>)}
            </select>
          </Field>
          <Field label="Minimum age" htmlFor="er-lo">
            <input id="er-lo" type="number" min={0} max={120} value={minAge} onChange={e => setMinAge(e.target.value)} />
          </Field>
          <Field label="Maximum age" htmlFor="er-hi">
            <input id="er-hi" type="number" min={0} max={120} value={maxAge} onChange={e => setMaxAge(e.target.value)} />
          </Field>
        </div>

        <Banner kind={goesToFacultyAdmin ? 'ok' : 'warn'} icon={goesToFacultyAdmin ? 'check' : 'clock'}>
          {goesToFacultyAdmin
            ? <><b>{facultyName(draftFaculties[0]!)}&apos;s admin can decide this.</b> It stays inside the
              faculty running the tournament.</>
            : <><b>A university admin has to decide this.</b> {draftFaculties.length === 0
              ? 'Admitting every faculty is above a faculty admin’s scope.'
              : draftFaculties.length > 1
                ? `Admitting ${draftFaculties.length} faculties is above a faculty admin’s scope.`
                : 'The faculty admitted is not the one running the tournament.'}</>}
        </Banner>

        {/* คำขอแก้ไขไม่มีช่องเหตุผลให้ผู้จัดเขียน — บอกไว้ ดีกว่าให้พิมพ์ลงช่องที่ไม่ถูกส่ง */}
        <div className="sub">
          The admin sees the conditions you are asking for, not a reason for them — the request has no
          field for one. Say why in an announcement or a message if it needs saying.
        </div>

        {requestChange.isError ? (
          <Banner kind="crit"><b>Couldn&apos;t send the request.</b> {errorMessage(requestChange.error)}</Banner>
        ) : null}

        <div className="hstack">
          <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn primary" type="button" disabled={requestChange.isPending} onClick={send}>
            {requestChange.isPending ? 'Sending…' : 'Send to an admin'}
          </button>
        </div>
      </Modal>
    </>
  )
}
