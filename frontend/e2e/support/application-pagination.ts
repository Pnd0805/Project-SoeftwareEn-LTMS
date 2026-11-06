import { api, applyWithWholeTeam, createOpenTournament, loginToken } from './api'

/** Prepare history through the real API; the new application itself is submitted through the UI. */
export async function prepareApplicationPaginationCase() {
  const email = 'b6.lead@ku.th'
  const token = await loginToken(email)
  const teams = await api<{ items: Array<{ id: number; name: string; role: string; sportTypeId: number; readinessStatus: string }> }>(
    'GET', '/me/teams', token)
  const team = teams.items.find(item => item.role === 'leader' && item.sportTypeId === 3 && item.readinessStatus === 'Ready')
  if (!team) throw new Error('QA b6.lead needs a ready badminton team')
  const history = await api<{ pagination: { totalItems: number } }>('GET', '/me/applications', token)
  for (let count = history.pagination.totalItems; count < 20; count++) {
    const tournament = await createOpenTournament()
    await applyWithWholeTeam(email, tournament.id, team.id)
  }
  const tournament = await createOpenTournament()
  return { email, team, tournament }
}
