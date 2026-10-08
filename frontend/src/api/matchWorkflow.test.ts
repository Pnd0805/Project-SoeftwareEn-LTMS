import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import * as api from './matchWorkflow'
const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())
describe('OD-26 contracts', () => {
  it('uses delivered routes, methods and numeric team score keys', async () => {
    await api.abandonMatch(13, 'Rain')
    await api.decideOrganizerResult(13, { outcome: 'result', reason: 'No submission', winnerTeamId: 101, scoreData: { '101': 3, '102': 1 } })
    await api.challengeResult(13, { reason: 'Incorrect score', claimedWinnerTeamId: 101, claimedScoreData: { '101': 3, '102': 1 }, evidenceKeys: ['dispute_evidence/13/a.png'] })
    await api.fileResultComplaint(13, { reason: 'Late complaint' })
    await api.attachComplaintStatement(9, 'Checked the record')
    await api.decideResultComplaint(9, { outcome: 'upheld', remedy: 'record_only', note: 'Recorded' })
    await api.getResultComplaints(13); await api.getMatchDispute(13)
    const calls = fetchMock.mock.calls.map(([path, options]) => [path, options?.method, options?.body && JSON.parse(String(options.body))])
    expect(calls).toContainEqual(['/api/v1/matches/13/abandon', 'POST', { reason: 'Rain' }])
    expect(calls).toContainEqual(['/api/v1/matches/13/result/dispute', 'POST', { reason: 'Incorrect score', claimedWinnerTeamId: 101, claimedScoreData: { '101': 3, '102': 1 }, evidenceKeys: ['dispute_evidence/13/a.png'] }])
    expect(calls).toContainEqual(['/api/v1/match-result-complaints/9/statement', 'PUT', { statement: 'Checked the record' }])
    expect(calls).toContainEqual(['/api/v1/match-result-complaints/9/decision', 'POST', { outcome: 'upheld', remedy: 'record_only', note: 'Recorded' }])
  })
  it('preserves server deadline and permission errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'ORGANIZER_STILL_HAS_TIME', message: 'Wait', availableAt: '2026-10-03T00:00:00Z' } }), { status: 403 }))
    await expect(api.decideResultComplaint(9, { outcome: 'no_merit', remedy: 'record_only', note: 'Reason' })).rejects.toMatchObject({ code: 'ORGANIZER_STILL_HAS_TIME', status: 403 })
  })
})
