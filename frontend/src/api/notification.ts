import { apiFetch, mockDelay, USE_MOCK } from "./client";
import type { NotificationDto, NotificationListResponse } from "../types/notification.dto";
import {
  getMockNotifications,
  markMockNotificationRead,
  markMockNotificationsRead,
} from "../mocks/notification.mock";
import {
  markStoreNotificationRead, markStoreNotificationsRead, storeNotifications,
} from "../mocks/notificationBridge";

export async function getNotifications(userId: number, page = 1, unread = false): Promise<NotificationListResponse> {
  if (USE_MOCK) {
    /* การแจ้งเตือนที่ระบบสร้างเองระหว่างใช้งาน — href ถูกต้องเพราะสร้างจาก id จริง
       ถ้ารู้ว่าเป็นใครก็ตอบของคนนั้น แม้จะว่าง ดีกว่าโยนชุดตัวอย่างที่ลิงก์ตายให้
       ชุดที่เขียนมือเหลือไว้เผื่อกรณีที่ระบุตัวผู้ใช้ไม่ได้เลย */
    const own = storeNotifications(userId);
    if (own) return mockDelay({ items: own });
    return mockDelay(getMockNotifications(userId));
  }
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (unread) params.set('unread', 'true');
  return apiFetch<NotificationListResponse>(`/me/notifications?${params}`);
}

export async function markNotificationRead(userId: number, notificationId: number): Promise<NotificationDto | void> {
  if (USE_MOCK) {
    if (markStoreNotificationRead(notificationId)) return mockDelay(undefined);
    return mockDelay(markMockNotificationRead(userId, notificationId));
  }
  return apiFetch<NotificationDto>(`/me/notifications/${notificationId}/read`, { method: 'PATCH' });
}

export async function markNotificationsRead(userId: number): Promise<{ updated: number; unreadCount: number } | void> {
  if (USE_MOCK) {
    markStoreNotificationsRead(userId);
    return mockDelay(markMockNotificationsRead(userId));
  }
  return apiFetch<{ updated: number; unreadCount: number }>('/me/notifications/read-all', { method: 'POST' });
}
