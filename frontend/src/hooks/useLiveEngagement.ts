import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { retryPolicy } from '../api/client'
import * as api from '../api/liveEngagement'

export function useReviews(id?: number) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['liveReviews', id], queryFn: () => api.getReviews(id!), enabled: !!id, retry: retryPolicy })
  const submit = useMutation({ mutationFn: ({ rating, content }: { rating: number; content: string }) => api.submitReview(id!, rating, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liveReviews', id] }) })
  return { query, submit }
}
export function useMvpLive(id?: number) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['liveMvp', id], queryFn: () => api.getMvp(id!), enabled: !!id, retry: retryPolicy })
  const vote = useMutation({ mutationFn: (userId: number) => api.voteMvp(id!, userId), onSuccess: () => qc.invalidateQueries({ queryKey: ['liveMvp', id] }) })
  return { query, vote }
}
export function useCommentsLive(id?: number, page = 1, reported = false) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['liveComments', id, page, reported], queryFn: () => api.getComments(id!, page, reported), enabled: !!id, retry: retryPolicy })
  const refresh = () => qc.invalidateQueries({ queryKey: ['liveComments', id] })
  const post = useMutation({ mutationFn: (content: string) => api.postComment(id!, content), onSuccess: refresh })
  const removeMine = useMutation({ mutationFn: () => api.deleteOwnComment(id!), onSuccess: refresh })
  const moderate = useMutation({ mutationFn: ({ commentId, reason }: { commentId: number; reason: string }) => api.removeCommentByOrganizer(id!, commentId, reason), onSuccess: refresh })
  const report = useMutation({ mutationFn: api.reportFeedback, onSuccess: refresh })
  return { query, post, removeMine, moderate, report }
}
export function usePredictionLive(id?: number) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['livePrediction', id], queryFn: () => api.getPredictionSummary(id!), enabled: !!id, retry: retryPolicy })
  const refresh = () => qc.invalidateQueries({ queryKey: ['livePrediction', id] })
  const place = useMutation({ mutationFn: (teamId: number) => api.placePrediction(id!, teamId), onSuccess: refresh })
  const cancel = useMutation({ mutationFn: () => api.cancelPrediction(id!), onSuccess: refresh })
  return { query, place, cancel }
}
export const usePickemHistory = (enabled: boolean) => useQuery({ queryKey: ['livePickemHistory'], queryFn: api.getPickemHistory, enabled, retry: retryPolicy })
export const usePickemLeaderboard = (id?: number) => useQuery({ queryKey: ['livePickemLeaderboard', id], queryFn: () => api.getPickemLeaderboard(id!), enabled: !!id, retry: retryPolicy })
