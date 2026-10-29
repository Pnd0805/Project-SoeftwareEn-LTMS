import type { NotificationDto, NotificationListResponse } from "../types/notification.dto";

const notifications: NotificationDto[] = [
  {
    id: 1,
    userId: 1,
    message: "Campus Chess Ladder is waiting on your approval.",
    href: "/admin",
    read: false,
    createdAt: "2026-08-30T14:00:00+07:00",
  },
  {
    id: 2,
    userId: 2,
    message: "Shuttle Squad registered for Inter-Faculty Futsal 2026.",
    href: "/t/2/manage/registrations",
    read: false,
    createdAt: "2026-08-31T14:00:00+07:00",
  },
  {
    id: 3,
    userId: 2,
    message: "A result in Faculty Football Cup 2026 was disputed.",
    href: "/m/1",
    read: false,
    createdAt: "2026-09-01T14:00:00+07:00",
  },
  {
    id: 4,
    userId: 3,
    message: "You were appointed to officiate Faculty Basketball Showdown.",
    href: "/matches",
    read: false,
    createdAt: "2026-08-30T14:00:00+07:00",
  },
  {
    id: 5,
    userId: 4,
    message: "Your request to organize Campus Chess Ladder is with an admin.",
    href: "/t/3",
    read: true,
    createdAt: "2026-08-30T14:00:00+07:00",
  },
  {
    id: 6,
    userId: 5,
    message: "Circuit Breakers invited you to join the squad.",
    href: "/teams",
    read: false,
    createdAt: "2026-09-01T14:00:00+07:00",
  },
];

export async function getMockNotifications(userId: number): Promise<NotificationListResponse> {
  return {
    items: notifications
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export async function markMockNotificationRead(userId: number, notificationId: number): Promise<void> {
  const notification = notifications.find(
    (item) => item.userId === userId && item.id === notificationId,
  );
  if (notification) notification.read = true;
}

export async function markMockNotificationsRead(userId: number): Promise<void> {
  notifications
    .filter((notification) => notification.userId === userId)
    .forEach((notification) => { notification.read = true; });
}
