import { apiFetch, ApiError, USE_MOCK } from './client'
import type { ComplaintDecisionInput, MatchDispute, OrganizerResultInput, ResultChallengeInput, ResultComplaint } from '../types/matchWorkflow.dto'
const request = <T>(path: string, method = 'GET', body?: object): Promise<T> => {
  if (USE_MOCK) return Promise.reject(new ApiError(501, { code: 'ENDPOINT_UNAVAILABLE', message: 'This workflow requires the real backend.' }))
  return apiFetch<T>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
}
export const abandonMatch = (id: number, reason: string) => request(`/matches/${id}/abandon`, 'POST', { reason })
export const decideOrganizerResult = (id: number, input: OrganizerResultInput) => request(`/matches/${id}/result/organizer`, 'POST', input)
export const getMatchDispute = (id: number) => request<MatchDispute>(`/matches/${id}/result/dispute`)
export const challengeResult = (id: number, input: ResultChallengeInput) => request(`/matches/${id}/result/dispute`, 'POST', input)
export const getResultComplaints = (id: number) => request<{ matchId: number; complaints: ResultComplaint[] }>(`/matches/${id}/result/complaints`)
export const fileResultComplaint = (id: number, input: ResultChallengeInput) => request<ResultComplaint>(`/matches/${id}/result/complaints`, 'POST', input)
export const attachComplaintStatement = (id: number, statement: string) => request<ResultComplaint>(`/match-result-complaints/${id}/statement`, 'PUT', { statement })
export const decideResultComplaint = (id: number, input: ComplaintDecisionInput) => request<ResultComplaint>(`/match-result-complaints/${id}/decision`, 'POST', input)
