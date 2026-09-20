/**
 * src/features/tournament/RegisterForm.tsx
 *
 * One registration form, two doors — from the tournament page or from a squad.
 * `options` is what the tournament field may still be changed to; a single entry
 * means the choice was made by the door you came in through, so it is stated
 * rather than offered.
 *
 * The Squad list is picked here, and the Hard filter is checked against those
 * players only — a member left off cannot fail it, because they are not entering.
 */
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banner, Field, TableWrap } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useLtms } from '../../shared/store'
import { useApplyToTournament } from '../../hooks/useTournament'
import { useBackendMyTeams } from '../../hooks/useTeam'
import { ApiError, USE_MOCK } from '../../api/client'
import { applyToTournamentSchema, type ApplyToTournamentInput } from '../../schemas/tournament.schema'
import { user } from '../../shared/selectors'
import { ageOf, hardFilter, regWindowClosed, ruleSummary } from '../../shared/rules'
import type { Team, Tournament } from '../../shared/types'
import { numOf } from '../../mocks/storeBridge'

/** รายชื่อผู้ที่ไม่ผ่านเงื่อนไขรับสมัคร ตามที่ backend ส่งกลับมากับ 422 */
type HardFilterFail = { userId: number; fullName: string; reason: string }

const REASON_LABEL: Record<string, string> = {
  gender: 'เงื่อนไขเพศ',
  age: 'เงื่อนไขอายุ',
  year: 'เงื่อนไขชั้นปี',
  faculty: 'เงื่อนไขคณะ',
}

/** What the organizer wrote about entering — shown, never checked by the system. */
function EntryNotesBlock({ tr }: { tr: Tournament }) {
  const notes = (tr.entryNotes ?? '').trim()
  if (!notes) return null
  return (
    <Banner kind="warn">
      <b>Soft filter from the organizer.</b> The system does not check these — they do, when they review your squad.
      <br />{notes}
    </Banner>
  )
}

export function RegisterForm({
  team: tm, options, tournament, sportTypeId, backendTeam, open, onClose,
}: {
  /** ทีมจาก store — มีเฉพาะโหมด mock · โหมดจริงเลือกทีมจาก GET /me/teams ในฟอร์มนี้เอง */
  team?: Team
  options: Tournament[]
  tournament: Tournament
  /** กีฬาของรายการ — กรองทีมให้เหลือเฉพาะกีฬาเดียวกัน (backend ยังไม่ตรวจข้อนี้ให้) */
  sportTypeId?: number
  /**
   * เข้ามาทางประตูของทีม — ทีมถูกเลือกมาแล้ว เหลือให้เลือกแค่รายการแข่ง
   * (ประตูของรายการแข่งทำกลับกัน: รายการถูกล็อก เลือกทีมเอา)
   */
  backendTeam?: { id: number; name: string }
  open: boolean
  onClose: () => void
}) {
  const s = useLtms()
  const [trId, setTrId] = useState(tournament.id)
  const [squad, setSquad] = useState<string[]>(tm?.members ?? [])
  const [serverError, setServerError] = useState<string | null>(null)
  /* 422 HARD_FILTER_FAILED ส่งรายชื่อคนที่ไม่ผ่านมาให้ด้วย — ต้องบอกว่าใครและเพราะอะไร
     ไม่งั้นหัวหน้าทีมเห็นแค่ "สมาชิกบางคนไม่ผ่านเงื่อนไข" แล้วแก้อะไรไม่ถูก */
  const [blockedMembers, setBlockedMembers] = useState<HardFilterFail[]>([])
  /* หาในตัวเลือกที่ส่งเข้ามาก่อน แล้วค่อยถอยไปหาใน store (โหมด mock)
     ถ้าอ่านจาก store อย่างเดียว การเปลี่ยนรายการในโหมดจริงจะไม่มีผลอะไรเลย */
  const tr = options.find(o => o.id === trId) ?? s.tournaments.find(t => t.id === trId) ?? tournament
  // The live backend evaluates the complete team. Keep the prototype-only
  // precheck solely for mock mode and surface the server decision otherwise.
  const fails = useMemo(() => USE_MOCK && tm ? hardFilter(s, tm, tr, squad) : [], [s, tm, tr, squad])
  const shut = regWindowClosed(tr)
  const locked = options.length < 2
  /* ชั้น API รับได้ทั้ง id ตัวเลขและ id ของ store — ส่งตัวที่หน้าถืออยู่ */
  const apply = useApplyToTournament(tr.id)
  const backendTeams = useBackendMyTeams()
  const { control, register, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<ApplyToTournamentInput>({
    resolver: zodResolver(applyToTournamentSchema),
    defaultValues: {
      teamId: backendTeam ? backendTeam.id
        : tm ? (Number.isFinite(Number(tm.id)) ? Number(tm.id) : numOf(tm.id))
          : 0,
    },
  })
  const selectedTeamId = useWatch({ control, name: 'teamId' })
  const eligibleTeams = (backendTeams.data?.items ?? []).filter(team =>
    team.role === 'leader'
    && team.readinessStatus === 'Ready'
    && (sportTypeId === undefined || team.sportTypeId === sportTypeId))

  useEffect(() => {
    if (backendTeam) return
    if (!USE_MOCK && eligibleTeams.length && !eligibleTeams.some(team => team.id === selectedTeamId)) {
      setValue('teamId', eligibleTeams[0].id, { shouldValidate: true })
    }
  }, [backendTeam, eligibleTeams, selectedTeamId, setValue])

  const toggle = (id: string) =>
    setSquad(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]))

  const submit = async (input: ApplyToTournamentInput) => {
    setServerError(null)
    setBlockedMembers([])
    try {
      await apply.mutateAsync(input)
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => setError(field as keyof ApplyToTournamentInput, { type: 'server', message }))
      }
      if (error instanceof ApiError) {
        setServerError(error.message)
        if (error.code === 'HARD_FILTER_FAILED' && Array.isArray(error.details)) {
          setBlockedMembers(error.details as HardFilterFail[])
        }
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={tm ? `Register ${tm.name}` : backendTeam ? `Register ${backendTeam.name}` : 'Register a squad'}>
      <form onSubmit={handleSubmit(submit)}>
      <input type="hidden" {...register('teamId', { valueAsNumber: true })} />
      {!USE_MOCK && backendTeam ? (
        <Field label="Team">
          <div className="sub">{backendTeam.name}</div>
        </Field>
      ) : null}
      {!USE_MOCK && !backendTeam ? (
        <Field label="Team" htmlFor="rg-team">
          {backendTeams.isPending ? <div className="sub">Loading your eligible teams…</div>
            : backendTeams.isError ? <div className="sub">Unable to load your teams. <button className="btn ghost" type="button" onClick={() => backendTeams.refetch()}>Try again</button></div>
              : eligibleTeams.length ? (
                <select id="rg-team" value={selectedTeamId} onChange={event => setValue('teamId', Number(event.target.value), { shouldValidate: true })}>
                  {eligibleTeams.map(team => <option key={team.id} value={team.id}>{team.name} · {team.memberCount} members</option>)}
                </select>
              ) : <div className="sub">You need a team you lead with Ready status before registering.</div>}
        </Field>
      ) : null}
      {locked ? (
        <Field label="Tournament">
          <div className="sub">{tr.name} — {tr.sport} · {tr.channel}</div>
        </Field>
      ) : (
        <Field label="Tournament" htmlFor="rg-tour">
          <select id="rg-tour" value={trId} onChange={e => setTrId(e.target.value)}>
            {options.map(x => <option key={x.id} value={x.id}>{x.name} — {x.sport}</option>)}
          </select>
        </Field>
      )}

      {USE_MOCK ? <><span className="tag">
        <em>//</em> Who is entering — the entry rules are checked against these players only
      </span>
      <TableWrap>
        <table>
          <thead><tr><th>In</th><th>Player</th><th>Faculty</th><th>Year</th><th>Age</th></tr></thead>
          <tbody>
            {(tm?.members ?? []).map(id => {
              const u = user(s, id)
              if (!u) return null
              return (
                <tr key={id}>
                  <td>
                    <input type="checkbox" checked={squad.includes(id)} onChange={() => toggle(id)}
                      aria-label={`Enter ${u.name}`} />
                  </td>
                  <td>{u.name}{tm?.leader === id ? <span className="tag"> · leader</span> : null}</td>
                  <td className="sub">{u.faculty}</td>
                  <td className="num">{u.year}</td>
                  <td className="num">{ageOf(u.dob)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap></> : <Banner kind="warn">The backend evaluates the current roster of the selected team when you submit.</Banner>}

      <EntryNotesBlock tr={tr} />

      {serverError ? (
        <Banner kind="crit">
          <b>Registration could not be submitted.</b><br />{serverError}
          {blockedMembers.length ? (
            <>
              <br /><br />
              <b>{blockedMembers.length} player{blockedMembers.length === 1 ? '' : 's'} did not clear the entry rules:</b>
              <br />
              {blockedMembers.map(fail => (
                <span key={fail.userId}>
                  {fail.fullName} — {REASON_LABEL[fail.reason] ?? fail.reason}<br />
                </span>
              ))}
              Everyone on the roster is checked, so the squad either changes or enters a different tournament.
            </>
          ) : null}
        </Banner>
      ) : null}
      {shut ? <Banner kind="crit"><b>{shut}</b></Banner>
        : USE_MOCK && fails.length ? (
          <Banner kind="crit">
            <b>The hard filter refuses this squad list.</b> Nobody can override it — leave the named players
            off, or enter a different tournament.
            <br />
            {fails.map((f, i) => (
              <span key={i}>{f.user.name} — {f.rule}: needs {String(f.need)}, has {String(f.got)}<br /></span>
            ))}
          </Banner>
        ) : (
          <Banner kind="ok">
            {USE_MOCK
              ? `All ${squad.length} entering players clear the entry conditions${ruleSummary(tr.rules) ? ` (${ruleSummary(tr.rules)})` : ''}. The organizer reviews it next.`
              : `Entry rules: ${ruleSummary(tr.rules) || 'open to everybody'}. The server checks every player on the roster when you submit.`}
          </Banner>
        )}

      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        {errors.teamId?.message ? <span className="sub">{errors.teamId.message}</span> : null}
        <button className="btn primary" type="submit"
          disabled={!!fails.length || !!shut
            || (USE_MOCK ? !squad.length : !(backendTeam || eligibleTeams.length))
            || isSubmitting || apply.isPending}>
          Submit registration
        </button>
      </div>
      </form>
    </Modal>
  )
}
