import { useState } from 'react'
import { Banner, Facts, TableWrap } from '../../components/kit/primitives'
import { useTournament, useEligibilityRules } from '../../hooks/useTournament'
import { useFaculties } from '../../hooks/useReference'
import { dateRange } from '../../shared/display'
import { formatAmendmentChanges } from '../../shared/amendmentChanges'
export function TournamentReviewDetails({ id, changes }: { id: number; changes?: Record<string, unknown> }) {
  const tournament = useTournament(id)
  const rules = useEligibilityRules(id)
  const faculties = useFaculties()
  const facultyName = (id: number) => faculties.data?.items.find(f => f.id === id)?.name ?? `Faculty #${id}`
  if (tournament.isPending) return <p>Loading review details…</p>
  if (tournament.isError || !tournament.data) return <Banner kind="crit">Review details could not be loaded. <button className="btn" onClick={() => void tournament.refetch()}>Retry details</button></Banner>
  const t = tournament.data
  const current = { ...t, eligibilityRules: rules.data?.items }
  return <>
    <Facts rows={[
      ['Dates', dateRange(t.eventStartDate, t.eventEndDate)], ['Venue', t.venue ?? 'Not specified'], ['Squads', `${t.minTeams ?? '—'} minimum · ${t.maxTeams ?? '—'} maximum · ${t.approvedTeamCount ?? '—'} approved`],
      ['Gender', t.genderRequirement ?? 'Any'], ['Age', `${t.minAge ?? 'Any'} – ${t.maxAge ?? 'Any'}`],
      ['Eligibility', rules.isError ? 'Could not load eligibility' : rules.isPending ? 'Loading…' : formatAmendmentChanges({ eligibilityRules: rules.data?.items ?? [] }, facultyName)[0]?.value],
    ]} />
    {rules.isError ? <button className="btn" onClick={() => void rules.refetch()}>Retry eligibility</button> : null}
    {changes ? <TableWrap><table><thead><tr><th>Field</th><th>Current</th><th>Requested</th></tr></thead><tbody>{formatAmendmentChanges(changes, facultyName).map(row => <tr key={row.field}><td>{row.label}</td><td>{row.field === 'eligibilityRules' && !rules.data ? 'Unavailable' : formatAmendmentChanges({ [row.field]: current[row.field as keyof typeof current] }, facultyName)[0]?.value}</td><td>{row.value}</td></tr>)}</tbody></table></TableWrap> : null}
  </>
}

export function TournamentReviewDisclosure({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary>Review dates, venue and entry conditions</summary>{open ? <TournamentReviewDetails id={id} /> : null}</details>
}
