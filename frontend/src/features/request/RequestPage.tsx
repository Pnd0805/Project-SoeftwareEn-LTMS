/**
 * src/features/request/RequestPage.tsx
 *
 * Requesting a tournament is one form in four groups: what it is, when entry is
 * open, how long it runs, and who may enter. The entry conditions are set here
 * and only here — after an admin approves them, changing them means asking again
 * with a reason.
 */
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { useCreateTournament } from '../../hooks/useTournament'
import { useSportTypes } from '../../hooks/useReference'
import { useMe } from '../../hooks/useAuth'
import { ApiError } from '../../api/client'
import { createTournamentSchema, type CreateTournamentInput } from '../../schemas/tournament.schema'
import { BracketFormatOptions, BracketFormatLabel, GenderRequirementOptions, GenderRequirementLabel, TournamentScopeTypeOptions, TournamentScopeTypeLabel } from '../../types/enums'

export function RequestPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: sports } = useSportTypes()
  const create = useCreateTournament()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CreateTournamentInput>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: { sportTypeId: 1, bracketFormat: 'single_elimination', scopeType: 'university', eventStartDate: '2026-04-01', maxTeams: 8, minTeams: 2, genderRequirement: 'any' },
  })

  if (!me) return null
  const submit = async (input: CreateTournamentInput) => {
    try {
      const result = await create.mutateAsync(input)
      navigate(`/t/${result.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => setError(field as keyof CreateTournamentInput, { type: 'server', message }))
      }
    }
  }
  const fieldError = (field: keyof CreateTournamentInput) => errors[field]?.message

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
                  {TournamentScopeTypeOptions.map(x => <option key={x} value={x}>{TournamentScopeTypeLabel[x]}</option>)}
                </select>
              </Field>
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
            <div className="grid2">
              <Field label="First match date" htmlFor="rq-date">
                <input id="rq-date" type="date" {...register('eventStartDate')} />
              </Field>
              <Field label="Default venue" htmlFor="rq-venue">
                <input id="rq-venue" {...register('venue')} placeholder="Main Stadium" />
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
              <Field label="Minimum age" htmlFor="rq-lo">
                <input id="rq-lo" type="number" {...register('minAge', { setValueAs: value => value === '' ? null : Number(value) })} />
              </Field>
              <Field label="Maximum age" htmlFor="rq-hi">
                <input id="rq-hi" type="number" {...register('maxAge', { setValueAs: value => value === '' ? null : Number(value) })} />
              </Field>
              <Field label="Faculty" htmlFor="rq-fac">
                <select id="rq-fac" {...register('organizingFacultyId', { setValueAs: value => value === '' ? null : Number(value) })}>
                  <option value="">Any</option>{[1, 2, 3, 4, 5, 6, 7, 8].map(f => <option key={f} value={f}>Faculty {f}</option>)}
                </select>
              </Field>
            </div>
          </Panel>

          <div className="hstack">
            <button className="btn" type="button" onClick={() => navigate('/')}>Cancel</button>
            <button className="btn primary" type="submit" disabled={isSubmitting || create.isPending}>
              Send the request
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
