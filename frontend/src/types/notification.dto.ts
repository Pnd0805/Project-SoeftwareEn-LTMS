/** Notification DTOs for the Slice 1 Inbox domain. */

export interface NotificationDto {
  id: number;
  userId?: number; // mock-only
  type?: string;
  title?: string;
  message: string;
  href?: string | null; // mock-only
  read?: boolean; // mock-only
  relatedEntityType?: 'tournament' | 'match' | 'team' | null;
  relatedEntityId?: number | null;
  isRead?: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  unreadCount?: number;
  pagination?: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
