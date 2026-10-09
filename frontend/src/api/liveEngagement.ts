import { apiFetch } from './client'
import type { CommentPage, MvpSummary, PickemHistory, PickemLeaderboard, PredictionSummary, ReviewSummary, TournamentComment } from '../types/liveEngagement.dto'

const json = (body: object) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const getReviews = (id: number) => apiFetch<ReviewSummary>(`/tournaments/${id}/feedback`)
export const submitReview = (id: number, rating: number, content: string) =>
  apiFetch<ReviewSummary['mine']>(`/tournaments/${id}/feedback`, { method: 'POST', ...json({ rating, content }) })
export const getMvp = (id: number) => apiFetch<MvpSummary>(`/matches/${id}/mvp-votes`)
export const voteMvp = (id: number, userId: number) =>
  apiFetch<{ matchId: number; votedForUserId: number; changed: boolean }>(`/matches/${id}/mvp-votes`, { method: 'POST', ...json({ userId }) })
export const getComments = (id: number, page = 1, reported = false) =>
  apiFetch<CommentPage>(`/tournaments/${id}/comments?page=${page}&pageSize=20${reported ? '&reported=true' : ''}`)
export const postComment = (id: number, content: string) =>
  apiFetch<TournamentComment>(`/tournaments/${id}/comments`, { method: 'POST', ...json({ content }) })
export const deleteOwnComment = (id: number) =>
  apiFetch<void>(`/tournaments/${id}/comments/me`, { method: 'DELETE' })
export const removeCommentByOrganizer = (id: number, commentId: number, reason: string) =>
  apiFetch<void>(`/tournaments/${id}/comments/${commentId}`, { method: 'DELETE', ...json({ reason }) })
export const dismissCommentReport = (id: number, commentId: number) =>
  apiFetch<{ id: number; isReported: false }>(`/tournaments/${id}/comments/${commentId}/dismiss-report`, { method: 'POST' })
export const reportFeedback = (id: number) =>
  apiFetch<{ id: number; isReported: true }>(`/feedback/${id}/report`, { method: 'POST' })
export const removeFeedbackByAdmin = (id: number, reason?: string) =>
  apiFetch<void>(`/admin/feedback/${id}`, { method: 'DELETE', ...json({ reason }) })
export const restoreFeedbackByAdmin = (id: number) =>
  apiFetch<{ id: number; restored: true }>(`/admin/feedback/${id}/restore`, { method: 'POST' })
export const getRemovedFeedback = (page = 1) =>
  apiFetch<import('../types/liveEngagement.dto').RemovedFeedbackPage>(`/admin/feedback/removed?page=${page}&pageSize=20`)
export const getPredictionSummary = (id: number) => apiFetch<PredictionSummary>(`/matches/${id}/predictions/summary`)
export const placePrediction = (id: number, scoreData: Record<string, number>) =>
  apiFetch<{ matchId: number; teamId: number; scoreData: Record<string, number>; changed: boolean }>(`/matches/${id}/predictions`, { method: 'POST', ...json({ scoreData }) })
export const cancelPrediction = (id: number) => apiFetch<void>(`/matches/${id}/predictions/me`, { method: 'DELETE' })
export const getPickemHistory = () => apiFetch<PickemHistory>('/me/pickem')
export const getPickemLeaderboard = (id: number, page = 1, pageSize = 20) => apiFetch<PickemLeaderboard>(`/tournaments/${id}/pickem-leaderboard?page=${page}&pageSize=${pageSize}`)
