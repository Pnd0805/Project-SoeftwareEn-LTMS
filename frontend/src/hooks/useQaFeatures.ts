import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { retryPolicy } from '../api/client'
import * as api from '../api/qaFeatures'

export function useJoinRequests(teamId: number, leader: boolean, signedIn: boolean) {
  const qc = useQueryClient()
  const team = useQuery({ queryKey: ['teamJoinRequests', teamId], queryFn: () => api.getTeamJoinRequests(teamId), enabled: leader, retry: retryPolicy })
  const mine = useQuery({ queryKey: ['myJoinRequests'], queryFn: api.getMyJoinRequests, enabled: signedIn, retry: retryPolicy })
  const action = useMutation({ mutationFn: (input: { kind: 'join'; message: string } | { kind: 'visibility'; visibility: 'public' | 'private' } | { kind: 'review'; id: number; approve: boolean; reason?: string } | { kind: 'cancel'; id: number }) => {
    switch (input.kind) {
      case 'join': return api.requestToJoin(teamId, input.message)
      case 'visibility': return api.setTeamVisibility(teamId, input.visibility)
      case 'review': return api.reviewJoinRequest(teamId, input.id, input.approve, input.reason)
      case 'cancel': return api.cancelJoinRequest(input.id)
    }
  }, onSuccess: () => { for (const key of ['teamJoinRequests', 'myJoinRequests', 'team', 'teams', 'users', 'notifications']) void qc.invalidateQueries({ queryKey: [key] }) } })
  return { team, mine, action }
}
export function useNotificationPreferences() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['notificationPreferences'], queryFn: api.getNotificationPreferences, retry: retryPolicy })
  const save = useMutation({ mutationFn: (v: { key: Exclude<api.NotificationCategory, 'critical'>; enabled: boolean }) => api.updateNotificationPreference(v.key, v.enabled),
    onSuccess: data => { qc.setQueryData(['notificationPreferences'], data); void qc.invalidateQueries({ queryKey: ['notifications'] }) } })
  return { query, save }
}
export function useUserReports(page: number, enabled: boolean) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['userReports', page], queryFn: () => api.getUserReports(page), enabled, retry: retryPolicy })
  const decide = useMutation({ mutationFn: (v: { id: number; approve: boolean; reason?: string; category?: string; days?: number }) => {
    const { id, approve, ...input } = v
    return api.decideUserReport(id, approve, input)
  }, onSuccess: () => { for (const key of ['userReports', 'admin', 'audit']) void qc.invalidateQueries({ queryKey: [key] }) } })
  return { query, decide }
}
export function useReportUser(userId: number) {
  return useMutation({ mutationFn: (v: { reason: string; evidence: string[] }) => api.reportUser(userId, v.reason, v.evidence) })
}
export function useStalledWork(enabled: boolean) {
  return useQuery({ queryKey: ['admin', 'stalled'], queryFn: api.getStalledWork, enabled, retry: retryPolicy })
}
