import { apiFetch } from './client'
import type { CommentPage, MvpSummary, PickemHistory, PickemLeaderboard, PredictionSummary, ReviewSummary, TournamentComment } from '../types/liveEngagement.dto'

const json = (body: object) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const getReviews = (id: number) => apiFetch<ReviewSummary>(`/tournaments/${id}/feedback`)
export const submitReview = (id: number, rating: number, content: string) =>
  apiFetch<ReviewSummary['mine']>(`/tournaments/${id}/feedback`, { method: 'POST', ...json({ rating, content }) })
export const getMvp = (id: number) => apiFetch<MvpSummary>(`/tournaments/${id}/mvp-votes`)
export const voteMvp = (id: number, userId: number) =>
  apiFetch<{ tournamentId: number; votedForUserId: number; changed: boolean }>(`/tournaments/${id}/mvp-votes`, { method: 'POST', ...json({ userId }) })
export const getComments = (id: number, page = 1, reported = false) =>
  apiFetch<CommentPage>(`/tournaments/${id}/comments?page=${page}&pageSize=20${reported ? '&reported=true' : ''}`)
export const postComment = (id: number, content: string) =>
  apiFetch<TournamentComment>(`/tournaments/${id}/comments`, { method: 'POST', ...json({ content }) })
export const deleteOwnComment = (id: number) =>
  apiFetch<void>(`/tournaments/${id}/comments/me`, { method: 'DELETE' })
export const removeCommentByOrganizer = (id: number, commentId: number, reason: string) =>
  apiFetch<void>(`/tournaments/${id}/comments/${commentId}`, { method: 'DELETE', ...json({ reason }) })
export const reportFeedback = (id: number) =>
  apiFetch<{ id: number; isReported: true }>(`/feedback/${id}/report`, { method: 'POST' })
export const removeFeedbackByAdmin = (id: number, reason?: string) =>
  apiFetch<void>(`/admin/feedback/${id}`, { method: 'DELETE', ...json({ reason }) })
export const restoreFeedbackByAdmin = (id: number) =>
  apiFetch<{ id: number; restored: true }>(`/admin/feedback/${id}/restore`, { method: 'POST' })
export const getPredictionSummary = (id: number) => apiFetch<PredictionSummary>(`/matches/${id}/predictions/summary`)
export const placePrediction = (id: number, teamId: number) =>
  apiFetch<{ matchId: number; teamId: number; changed: boolean }>(`/matches/${id}/predictions`, { method: 'POST', ...json({ teamId }) })
export const cancelPrediction = (id: number) => apiFetch<void>(`/matches/${id}/predictions/me`, { method: 'DELETE' })
export const getPickemHistory = () => apiFetch<PickemHistory>('/me/pickem')
export const getPickemLeaderboard = (id: number) => apiFetch<PickemLeaderboard>(`/tournaments/${id}/pickem-leaderboard`)
