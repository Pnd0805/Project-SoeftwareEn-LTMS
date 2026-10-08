import { apiFetch, USE_MOCK } from './client'
import type { UserRef } from '../types/dto'
import type { BackendPagination as Pagination } from '../types/match.dto'

const id = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid database ID')
  return value
}
function live<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (USE_MOCK) return Promise.reject(new Error('This feature requires the live server.'))
  return apiFetch<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
export interface JoinRequest {
  id: number; user: UserRef; message: string | null; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; createdAt: string
}
export interface MyJoinRequest extends Omit<JoinRequest, 'user'> {
  team: { id: number; name: string; sportTypeId: number }; rejectReason: string | null; respondedAt: string | null
}
export const getTeamJoinRequests = (teamId: number) => live<{ items: JoinRequest[] }>(`/teams/${id(teamId)}/join-requests`)
export const getMyJoinRequests = () => live<{ items: MyJoinRequest[] }>('/me/join-requests')
export const requestToJoin = (teamId: number, message: string) => live(`/teams/${id(teamId)}/join-requests`, 'POST', { message: message.trim() })
export const reviewJoinRequest = (teamId: number, requestId: number, approve: boolean, reason?: string) => live(`/teams/${id(teamId)}/join-requests/${id(requestId)}/${approve ? 'approve' : 'reject'}`, 'POST', approve ? undefined : { reason })
export const cancelJoinRequest = (requestId: number) => live<void>(`/me/join-requests/${id(requestId)}`, 'DELETE')
export const setTeamVisibility = (teamId: number, visibility: 'public' | 'private') => live(`/teams/${id(teamId)}`, 'PATCH', { visibility })

export type NotificationCategory = 'critical' | 'team' | 'tournament' | 'match' | 'referee' | 'result' | 'community'
export interface NotificationPreferences { categories: Array<{ key: NotificationCategory; enabled: boolean; locked: boolean }> }
export const getNotificationPreferences = () => live<NotificationPreferences>('/me/notification-prefs')
export const updateNotificationPreference = (key: Exclude<NotificationCategory, 'critical'>, enabled: boolean) => live<NotificationPreferences>('/me/notification-prefs', 'PATCH', { [key]: enabled })
export interface EmailNotificationPreferences { categories: Array<{ key: NotificationCategory; enabled: boolean; locked: boolean }>; delivery: { critical: 'immediate'; other: 'daily'; hourThailand: number } }
export const getEmailNotificationPreferences = () => live<EmailNotificationPreferences>('/me/email-notification-prefs')
export const updateEmailNotificationPreference = (key: NotificationCategory, enabled: boolean) => live<EmailNotificationPreferences>('/me/email-notification-prefs', 'PATCH', { [key]: enabled })

export interface UserReport {
  id: number; reporter: UserRef; target: UserRef & { isAdmin: boolean }; reason: string; evidence: string[]
  status: 'pending' | 'approved' | 'rejected'; createdAt: string; reviewedByName: string | null; reviewedAt: string | null; rejectionReason: string | null
}
export const reportUser = (userId: number, reason: string, evidence: string[]) => live(`/users/${id(userId)}/report`, 'POST', { reason: reason.trim(), evidence })
export const getUserReports = (page: number) => live<{ items: UserReport[]; pagination: Pagination }>(`/admin/user-reports?page=${id(page)}&pageSize=20`)
export const decideUserReport = (reportId: number, approve: boolean, input: { reason?: string; category?: string; days?: number }) => live(`/admin/user-reports/${id(reportId)}/${approve ? 'approve' : 'reject'}`, 'POST', input)
export interface StalledWork {
  thresholdHours: number; disputesPastDeadline: { count: number; matchIds: number[] }; complaintsAwaitingAdmin: { count: number; complaintIds: number[] }
  universityAdmins: { active: number; total: number }; needsAttention: boolean
}
export const getStalledWork = () => live<StalledWork>('/admin/oversight/stalled')
