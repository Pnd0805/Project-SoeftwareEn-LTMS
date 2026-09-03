/** Notification DTOs for the Slice 1 Inbox domain. */

export interface NotificationDto {
  id: number;
  userId: number;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
}
