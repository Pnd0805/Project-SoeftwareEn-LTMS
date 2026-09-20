/**
 * src/features/request/RequestPage.tsx
 *
 * Requesting a tournament is one form in four groups: what it is, when entry is
 * open, how long it runs, and who may enter. The entry conditions are set here
 * and only here — after an admin approves them, changing them means asking again
 * with a reason.
 *
 * ── ช่วงเวลาที่ backend บังคับ (tournament.service ensureSchedule) ──────────
 * เปิดรับสมัคร < ปิดรับสมัคร < วันแข่งวันแรก ≤ วันแข่งวันสุดท้าย และต้องส่งครบทั้งสี่
 * ช่องเวลาในเบราว์เซอร์ไม่มีโซนเวลา จึงแปลงเป็น ISO ตอนอ่านค่า เพราะ API รับเฉพาะแบบมีโซนเวลา
 *
 * ── ระดับการแข่งขันกับหน่วยงานที่จัด (ensureCreateReferences) ───────────────
 * ระดับคณะ: ต้องมีคณะ และห้ามส่งภาควิชา · ระดับภาควิชา: ต้องมีทั้งคณะและภาควิชาในคณะนั้น
 * 'university' มีในฐานข้อมูลแต่ยังไม่เปิดใช้ใน MVP จึงไม่ให้เลือก
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { useCreateTournament } from '../../hooks/useTournament'
import { useDepartments, useFaculties, useSportTypes } from '../../hooks/useReference'
import { useMe } from '../../hooks/useAuth'
import { ApiError } from '../../api/client'
import { createTournamentSchema, toEligibilityRules, type CreateTournamentInput } from '../../schemas/tournament.schema'
import { BracketFormatOptions, BracketFormatLabel, GenderRequirementOptions, GenderRequirementLabel, TournamentScopeTypeLabel } from '../../types/enums'

const SCOPES = ['faculty', 'department'] as const
const ADMIT = [
  ['all', 'Every faculty'],
  ['own', 'Only the faculty running it'],
  ['pick', 'Choose faculties'],
] as const
type AdmitMode = (typeof ADMIT)[number][0]
/** คณะที่รับจริงตามโหมด — ใช้ทั้งตอนแสดงผลและตอนส่ง จะได้ไม่มีสองสูตรให้เพี้ยนกันได้ */
const admittedOf = (mode: AdmitMode, organiser: number | null | undefined, picked: number[]) =>
  mode === 'pick' ? picked : mode === 'own' && organiser != null ? [organiser] : []

const pad = (n: number) => String(n).padStart(2, '0')
const asLocalDateTime = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000)
const asIdOrNull = (value: string) => (value === '' ? null : Number(value))

export function RequestPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: sports } = useSportTypes()
  const { data: faculties } = useFaculties()
  const create = useCreateTournament()
  const [sent, setSent] = useState<{ id: number; name: string } | null>(null)
  const { register, handleSubmit, setError, control, reset, setValue, formState: { errors, isSubmitting } } = useForm<CreateTournamentInput>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: {
      sportTypeId: 1,
      bracketFormat: 'single_elimination',
      scopeType: 'faculty',
      organizingFacultyId: null,
      organizingDepartmentId: null,
      registrationStart: asLocalDateTime(inDays(1)),
      registrationEnd: asLocalDateTime(inDays(14)),
      eventStartDate: asDate(inDays(21)),
      eventEndDate: asDate(inDays(22)),
      maxTeams: 8,
      minTeams: 2,
      venue: '',
      genderRequirement: 'any',
      eligibilityFacultyIds: [],
      eligibilityYears: [],
    },
  })
  /* ระดับการแข่งขันตัดสินว่าต้องเลือกภาควิชาด้วยไหม และภาควิชาต้องอยู่ในคณะที่เลือก */
  const scopeType = useWatch({ control, name: 'scopeType' })
  const organizingFacultyId = useWatch({ control, name: 'organizingFacultyId' })
  const { data: departments } = useDepartments(
    scopeType === 'department' ? organizingFacultyId ?? undefined : undefined,
  )
  /**
   * คณะถูกถามสองครั้งในฟอร์มเดียว และคนละความหมายกัน: ด้านบนคือ "คณะไหนเป็นผู้จัด"
   * ตรงนี้คือ "คณะไหนสมัครได้" กางรายชื่อคณะทิ้งไว้ทั้งสองที่แล้วอ่านเหมือนถามซ้ำ
   * จึงถามเป็นสามทางก่อน แล้วค่อยกางรายชื่อเฉพาะตอนเลือก "เจาะจง"
   * ค่าตั้งต้นคือรับทุกคณะเหมือนเดิม — ตั้งเป็น "เฉพาะคณะผู้จัด" ให้เองจะกลายเป็นตัดคนอื่น
   * ทิ้งโดยที่ผู้จัดไม่ได้สั่ง ซึ่งพลาดแล้วเจ็บกว่าคำขอไปเข้าคิวแอดมินมหาวิทยาลัย
   */
  const [admit, setAdmit] = useState<AdmitMode>('all')
  const pickedFaculties = useWatch({ control, name: 'eligibilityFacultyIds' }) ?? []
  const admittedYears = useWatch({ control, name: 'eligibilityYears' }) ?? []
  /* โหมด own ไม่เก็บสำเนา id ไว้ — อ่านจากช่องผู้จัดสดๆ เปลี่ยนคณะผู้จัดแล้วกฎตามไปเอง */
  const admittedFaculties = admittedOf(admit, organizingFacultyId, pickedFaculties)
  const toggleIn = (field: 'eligibilityFacultyIds' | 'eligibilityYears', list: number[], value: number) =>
    setValue(field, list.includes(value) ? list.filter(x => x !== value) : [...list, value].sort((a, b) => a - b))
  /**
   * ใครเป็นคนตัดสินคำขอนี้ (มติ 20 ก.ย. Q2-ข) — แอดมินคณะพิจารณาได้ก็ต่อเมื่อคณะ
   * ตัวเองเป็นผู้จัด **และ** กฎคณะจำกัดเฉพาะคณะนั้นคณะเดียว นอกนั้นเป็นเรื่องของ
   * แอดมินระดับมหาวิทยาลัย (`403 ELIGIBILITY_OUT_OF_SCOPE` ถ้าแอดมินคณะฝืนกด)
   * บอกไว้ตั้งแต่ตอนกรอก ผู้จัดจะได้รู้ว่าติ๊กคณะที่สองแล้วคิวเปลี่ยนมือ
   */
  const ownFacultyOnly = admittedFaculties.length === 1
    && organizingFacultyId != null
    && admittedFaculties[0] === organizingFacultyId
  const facultyName = (id: number) => (faculties?.items ?? []).find(f => f.id === id)?.name ?? `คณะ #${id}`

  if (!me) return null
  const submit = async (input: CreateTournamentInput) => {
    try {
      /* ระดับคณะห้ามมีภาควิชาติดไปด้วย แม้ผู้ใช้เคยเลือกไว้ก่อนสลับระดับ */
      const base = input.scopeType === 'faculty' ? { ...input, organizingDepartmentId: null } : input
      /* สองลิสต์ของฟอร์มไม่ใช่ช่องของ backend — ยุบเป็น eligibilityRules ก่อนส่ง
         และไม่ส่งช่องนั้นเลยถ้าไม่ได้จำกัดอะไร (ลิสต์ว่างกับไม่ส่งมีผลเท่ากัน) */
      const { eligibilityFacultyIds, eligibilityYears, ...rest } = base
      /* คิดคณะจากโหมดอีกรอบตรงนี้ ไม่ได้หยิบลิสต์ที่ติ๊กไว้ไปตรงๆ — คนที่ติ๊กเจาะจงแล้วสลับ
         กลับไป "ทุกคณะ" ยังมีค่าค้างในฟอร์ม ถ้าส่งค่านั้นไปคำขอจะจำกัดคณะโดยไม่ได้ตั้งใจ */
      const rules = toEligibilityRules(
        admittedOf(admit, base.organizingFacultyId, eligibilityFacultyIds ?? []),
        eligibilityYears,
      )
      const result = await create.mutateAsync(rules.length ? { ...rest, eligibilityRules: rules } : rest)
      /* คำขอที่ยังรออนุมัติเปิดหน้าทัวร์นาเมนต์ไม่ได้ — GET /tournaments/:id ตอบ 404 ให้เจ้าของ
         จนกว่าแอดมินจะอนุมัติ จึงจบที่หน้ายืนยัน ไม่พาไปหน้าที่เปิดไม่ได้ */
      setSent({ id: result.id, name: result.name })
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => setError(field as keyof CreateTournamentInput, { type: 'server', message }))
      }
    }
  }
  const fieldError = (field: keyof CreateTournamentInput) => errors[field]?.message
  /* server ตอบ error รายช่องก็จริง แต่ถ้ามันชี้ไปช่องที่ฟอร์มไม่มี ผู้ใช้จะไม่เห็นอะไรเลย
     แถบนี้จึงบอกไว้เสมอเมื่อส่งไม่สำเร็จ */
  const sendError = create.isError
    ? (create.error instanceof Error ? create.error.message : 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่')
    : null

  if (sent) {
    return (
      <>
        <div className="spread">
          <div>
            <div className="tag"><em>//</em> An admin decides</div>
            <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>Request sent</h1>
          </div>
        </div>
        <Panel>
          <Banner kind="ok"><b>{sent.name} is with an admin.</b> Nothing else is needed from you right now.</Banner>
          <div className="sub">
            Approved, it arrives as your Private draft under Tournaments: appoint the referees, then open it
            to the public. Until an admin decides, the tournament page stays closed — even to you.
          </div>
          <div className="hstack">
            <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
            <button className="btn primary" type="button" onClick={() => { setSent(null); reset() }}>Request another</button>
          </div>
        </Panel>
      </>
    )
  }

  return (
    <>
      <div className="spread">
        <div>
          <div className="tag"><em>//</em> An admin decides</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>Request a tournament</h1>
        </div>
      </div>

      <div className="split">
        <form onSubmit={handleSubmit(submit)}>
          {sendError ? <Banner kind="crit"><b>Could not send the request.</b> {sendError}</Banner> : null}

          <Panel>
            <span className="tag"><em>//</em> What it is</span>
            <Field label="Name" htmlFor="rq-name">
              <input id="rq-name" {...register('name')} placeholder="Faculty Football Cup 2026" aria-invalid={!!errors.name} />
              {fieldError('name') ? <span className="sub">{fieldError('name')}</span> : null}
            </Field>
            <div className="grid2">
              <Field label="Sport" htmlFor="rq-sport">
                <select id="rq-sport" {...register('sportTypeId', { valueAsNumber: true })}>
                  {(sports?.items ?? []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </Field>
              <Field label="Format — fixed once the draw is made" htmlFor="rq-format">
                <select id="rq-format" {...register('bracketFormat')}>
                  {BracketFormatOptions.map(f => <option key={f} value={f}>{BracketFormatLabel[f]}</option>)}
                </select>
              </Field>
              <Field label="Scope" htmlFor="rq-scope">
                <select id="rq-scope" {...register('scopeType')}>
                  {SCOPES.map(x => <option key={x} value={x}>{TournamentScopeTypeLabel[x]}</option>)}
                </select>
                {fieldError('scopeType') ? <span className="sub">{fieldError('scopeType')}</span> : null}
              </Field>
              <Field label="Organising faculty — who puts it on" htmlFor="rq-fac">
                <select id="rq-fac" {...register('organizingFacultyId', { setValueAs: asIdOrNull })}>
                  <option value="">Choose a faculty</option>
                  {(faculties?.items ?? []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {fieldError('organizingFacultyId') ? <span className="sub">{fieldError('organizingFacultyId')}</span> : null}
              </Field>
              {scopeType === 'department' ? (
                <Field label="Organising department" htmlFor="rq-dept">
                  <select id="rq-dept" {...register('organizingDepartmentId', { setValueAs: asIdOrNull })}>
                    <option value="">Choose a department</option>
                    {(departments?.items ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {fieldError('organizingDepartmentId') ? <span className="sub">{fieldError('organizingDepartmentId')}</span> : null}
                </Field>
              ) : null}
              <Field label="Squad cap" htmlFor="rq-cap">
                <input id="rq-cap" type="number" min={2} max={64} {...register('maxTeams', { valueAsNumber: true })} />
                {fieldError('maxTeams') ? <span className="sub">{fieldError('maxTeams')}</span> : null}
              </Field>
              <Field label="Minimum squads" htmlFor="rq-min-teams">
                <input id="rq-min-teams" type="number" min={1} {...register('minTeams', { valueAsNumber: true })} />
                {fieldError('minTeams') ? <span className="sub">{fieldError('minTeams')}</span> : null}
              </Field>
            </div>
          </Panel>

          <Panel>
            <span className="tag"><em>//</em> When and where</span>
            <div className="sub">
              Entry has to open and close before the first match. Every squad applies inside that window.
            </div>
            <div className="grid2">
              <Field label="Entry opens" htmlFor="rq-reg-start">
                <input id="rq-reg-start" type="datetime-local"
                  {...register('registrationStart')} />
                {fieldError('registrationStart') ? <span className="sub">{fieldError('registrationStart')}</span> : null}
              </Field>
              <Field label="Entry closes" htmlFor="rq-reg-end">
                <input id="rq-reg-end" type="datetime-local"
                  {...register('registrationEnd')} />
                {fieldError('registrationEnd') ? <span className="sub">{fieldError('registrationEnd')}</span> : null}
              </Field>
              <Field label="First match date" htmlFor="rq-date">
                <input id="rq-date" type="date" {...register('eventStartDate')} />
                {fieldError('eventStartDate') ? <span className="sub">{fieldError('eventStartDate')}</span> : null}
              </Field>
              <Field label="Last match date" htmlFor="rq-date-end">
                <input id="rq-date-end" type="date" {...register('eventEndDate')} />
                {fieldError('eventEndDate') ? <span className="sub">{fieldError('eventEndDate')}</span> : null}
              </Field>
              <Field label="Default venue" htmlFor="rq-venue">
                <input id="rq-venue" {...register('venue')} placeholder="Main Stadium" aria-invalid={!!errors.venue} />
                {fieldError('venue') ? <span className="sub">{fieldError('venue')}</span> : null}
              </Field>
            </div>
          </Panel>

          <Panel>
            <span className="tag"><em>//</em> Who may enter — the hard filter</span>
            <Banner kind="warn">
              <b>Every condition is optional, and every one you set is enforced with no override.</b>{' '}
              A squad with one failing player is rejected outright, and after approval these can only be
              changed by asking an admin again.
            </Banner>
            <div className="grid2">
              <Field label="Gender" htmlFor="rq-gender">
                <select id="rq-gender" {...register('genderRequirement')}>
                  {GenderRequirementOptions.map(x => <option key={x} value={x}>{GenderRequirementLabel[x]}</option>)}
                </select>
              </Field>
              {/* ขอบเขตเดียวกับ backend (optionalAge = int 0–120) — ไม่ใส่ min/max ไว้
                  ลูกศรของเบราว์เซอร์กดลงไปติดลบได้ แล้วค่อยไปเด้ง 400 ตอนกดส่ง */}
              <Field label="Minimum age" htmlFor="rq-lo">
                <input id="rq-lo" type="number" min={0} max={120}
                  {...register('minAge', { setValueAs: value => value === '' ? null : Number(value) })} />
                {fieldError('minAge') ? <span className="sub">{fieldError('minAge')}</span> : null}
              </Field>
              <Field label="Maximum age" htmlFor="rq-hi">
                <input id="rq-hi" type="number" min={0} max={120}
                  {...register('maxAge', { setValueAs: value => value === '' ? null : Number(value) })} />
              </Field>
            </div>

            <span className="tag"><em>//</em> Which faculties may enter</span>
            <div className="sub">
              A different question from the organising faculty above, which only says who is putting
              the tournament on.
            </div>
            <span className="segmented" role="radiogroup" aria-label="Which faculties may enter">
              {ADMIT.map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={admit === value}
                  className={admit === value ? 'on' : ''} onClick={() => setAdmit(value)}>{label}</button>
              ))}
            </span>
            {admit === 'pick' ? (
              <div className="grid2">
                {(faculties?.items ?? []).map(f => (
                  <label key={f.id} className="hstack" style={{ gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={pickedFaculties.includes(f.id)}
                      onChange={() => toggleIn('eligibilityFacultyIds', pickedFaculties, f.id)} />
                    <span>{f.name}</span>
                  </label>
                ))}
              </div>
            ) : null}

            <span className="tag"><em>//</em> Years of study — tick none to accept every year</span>
            <div className="hstack" style={{ flexWrap: 'wrap', gap: 14 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(y => (
                <label key={y} className="hstack" style={{ gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={admittedYears.includes(y)}
                    onChange={() => toggleIn('eligibilityYears', admittedYears, y)} />
                  <span>Year {y}</span>
                </label>
              ))}
            </div>

            {/* ใครตัดสินคำขอนี้เปลี่ยนตามจำนวนคณะที่ติ๊ก — บอกก่อนกดส่ง ไม่ใช่ให้ไปรู้
                ตอนคำขอค้างอยู่ในคิวที่ผิดคน */}
            <Banner kind={ownFacultyOnly ? 'ok' : 'warn'} icon={ownFacultyOnly ? 'check' : 'clock'}>
              {admit === 'own' && organizingFacultyId == null ? (
                <><b>Choose the organising faculty above first.</b> Entry is set to follow it, and while
                  that is blank the tournament admits every faculty.</>
              ) : ownFacultyOnly ? (
                <><b>{facultyName(admittedFaculties[0]!)}&apos;s admin decides this one.</b> It admits only
                  the faculty running it, so it stays inside that faculty.</>
              ) : admittedFaculties.length === 0 ? (
                <><b>A university admin decides this one.</b> It is open to every faculty, which is above
                  a faculty admin&apos;s scope.</>
              ) : admittedFaculties.length > 1 ? (
                <><b>A university admin decides this one.</b> It admits {admittedFaculties.length} faculties,
                  so no single faculty&apos;s admin can approve it.</>
              ) : (
                <><b>A university admin decides this one.</b> It admits {facultyName(admittedFaculties[0]!)},
                  which is not the faculty running it.</>
              )}
            </Banner>
          </Panel>

          <div className="hstack">
            <button className="btn" type="button" onClick={() => navigate('/')}>Cancel</button>
            <button className="btn primary" type="submit" disabled={isSubmitting || create.isPending}>
              {create.isPending ? 'Sending…' : 'Send the request'}
            </button>
          </div>
        </form>

        <div className="rail">
          <Panel quiet>
            <span className="tag"><em>//</em> What happens next</span>
            <div className="sub">
              An admin approves or declines it. Approved, it arrives as your <b>Private</b> draft: appoint
              the referees, then open it to the public. LTMS deletes a private tournament on its match date.
            </div>
            <span className="tag"><em>//</em> Entry conditions as they read now</span>
            <div style={{ fontSize: 15 }}>The server validates entry conditions before creating the request.</div>
          </Panel>
        </div>
      </div>
    </>
  )
}
