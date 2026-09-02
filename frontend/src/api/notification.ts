import { mockDelay, apiFetch, USE_MOCK } from "./client";
import type { NotificationListResponse } from "../types/notification.dto";
import {
  getMockNotifications,
  markMockNotificationRead,
  markMockNotificationsRead,
} from "../mocks/notification.mock";

export async function getNotifications(userId: number): Promise<NotificationListResponse> {
  if (USE_MOCK) return mockDelay(getMockNotifications(userId));
  // TODO(guide): confirm the notification list path in the Backend Design.
  return apiFetch<NotificationListResponse>("/me/notifications");
}

export async function markNotificationRead(userId: number, notificationId: number): Promise<void> {
  if (USE_MOCK) return mockDelay(markMockNotificationRead(userId, notificationId));
  // TODO(guide): confirm the notification read action path in the Backend Design.
  return apiFetch<void>(`/notifications/${notificationId}/read`, { method: "POST" });
}

export async function markNotificationsRead(userId: number): Promise<void> {
  if (USE_MOCK) return mockDelay(markMockNotificationsRead(userId));
  // TODO(guide): confirm the mark-all-read action path in the Backend Design.
  return apiFetch<void>("/notifications/read-all", { method: "POST" });
}
