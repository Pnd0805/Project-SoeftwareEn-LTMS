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
import { useForm } from 'react-hook-form'
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

export function RegisterForm({ team: tm, options, tournament, open, onClose }: {
  team: Team
  options: Tournament[]
  tournament: Tournament
  open: boolean
  onClose: () => void
}) {
  const s = useLtms()
  const [trId, setTrId] = useState(tournament.id)
  const [squad, setSquad] = useState<string[]>(tm.members)
  const [serverError, setServerError] = useState<string | null>(null)
  const tr = s.tournaments.find(t => t.id === trId) ?? tournament
  // The live backend evaluates the complete team. Keep the prototype-only
  // precheck solely for mock mode and surface the server decision otherwise.
  const fails = useMemo(() => USE_MOCK ? hardFilter(s, tm, tr, squad) : [], [s, tm, tr, squad])
  const shut = regWindowClosed(tr)
  const locked = options.length < 2
  /* ชั้น API รับได้ทั้ง id ตัวเลขและ id ของ store — ส่งตัวที่หน้าถืออยู่ */
  const apply = useApplyToTournament(tr.id)
  const backendTeams = useBackendMyTeams()
  const { register, handleSubmit, setError, setValue, watch, formState: { errors, isSubmitting } } = useForm<ApplyToTournamentInput>({
    resolver: zodResolver(applyToTournamentSchema),
    defaultValues: { teamId: Number.isFinite(Number(tm.id)) ? Number(tm.id) : numOf(tm.id) },
  })
  const selectedTeamId = watch('teamId')
  const eligibleTeams = (backendTeams.data?.items ?? []).filter(team => team.role === 'leader' && team.readinessStatus === 'Ready')

  useEffect(() => {
    if (!USE_MOCK && eligibleTeams.length && !eligibleTeams.some(team => team.id === selectedTeamId)) {
      setValue('teamId', eligibleTeams[0].id, { shouldValidate: true })
    }
  }, [eligibleTeams, selectedTeamId, setValue])

  const toggle = (id: string) =>
    setSquad(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]))

  const submit = async (input: ApplyToTournamentInput) => {
    setServerError(null)
    try {
      await apply.mutateAsync(input)
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => setError(field as keyof ApplyToTournamentInput, { type: 'server', message }))
      }
      if (error instanceof ApiError) setServerError(error.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Register ${tm.name}`}>
      <form onSubmit={handleSubmit(submit)}>
      <input type="hidden" {...register('teamId', { valueAsNumber: true })} />
      {!USE_MOCK ? (
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
            {tm.members.map(id => {
              const u = user(s, id)
              if (!u) return null
              return (
                <tr key={id}>
                  <td>
                    <input type="checkbox" checked={squad.includes(id)} onChange={() => toggle(id)}
                      aria-label={`Enter ${u.name}`} />
                  </td>
                  <td>{u.name}{tm.leader === id ? <span className="tag"> · leader</span> : null}</td>
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

      {serverError ? <Banner kind="crit"><b>Registration could not be submitted.</b><br />{serverError}</Banner> : null}
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
              : 'The server will verify team readiness and eligibility when you submit.'}
          </Banner>
        )}

      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        {errors.teamId?.message ? <span className="sub">{errors.teamId.message}</span> : null}
        <button className="btn primary" type="submit" disabled={!!fails.length || !!shut || (USE_MOCK ? !squad.length : !eligibleTeams.length) || isSubmitting || apply.isPending}>
          Submit registration
        </button>
      </div>
      </form>
    </Modal>
  )
}
