import { ApiError, mockDelay, USE_MOCK } from "./client";
import type { NotificationListResponse } from "../types/notification.dto";
import {
  getMockNotifications,
  markMockNotificationRead,
  markMockNotificationsRead,
} from "../mocks/notification.mock";
import {
  markStoreNotificationRead, markStoreNotificationsRead, storeNotifications,
} from "../mocks/notificationBridge";

export async function getNotifications(userId: number): Promise<NotificationListResponse> {
  if (USE_MOCK) {
    /* การแจ้งเตือนที่ระบบสร้างเองระหว่างใช้งาน — href ถูกต้องเพราะสร้างจาก id จริง
       ถ้ารู้ว่าเป็นใครก็ตอบของคนนั้น แม้จะว่าง ดีกว่าโยนชุดตัวอย่างที่ลิงก์ตายให้
       ชุดที่เขียนมือเหลือไว้เผื่อกรณีที่ระบุตัวผู้ใช้ไม่ได้เลย */
    const own = storeNotifications(userId);
    if (own) return mockDelay({ items: own });
    return mockDelay(getMockNotifications(userId));
  }
  throw new ApiError(501, {
    code: "ENDPOINT_UNAVAILABLE",
    message: "The server does not provide a notification inbox yet.",
  });
}

export async function markNotificationRead(userId: number, notificationId: number): Promise<void> {
  if (USE_MOCK) {
    if (markStoreNotificationRead(notificationId)) return mockDelay(undefined);
    return mockDelay(markMockNotificationRead(userId, notificationId));
  }
  throw new ApiError(501, {
    code: "ENDPOINT_UNAVAILABLE",
    message: "The server does not provide notification read actions yet.",
  });
}

export async function markNotificationsRead(userId: number): Promise<void> {
  if (USE_MOCK) {
    markStoreNotificationsRead(userId);
    return mockDelay(markMockNotificationsRead(userId));
  }
  throw new ApiError(501, {
    code: "ENDPOINT_UNAVAILABLE",
    message: "The server does not provide notification read actions yet.",
  });
}
