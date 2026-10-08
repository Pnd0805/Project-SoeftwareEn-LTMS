import type { NotificationRow } from '../repositories/notification.repo.js';

export type NotificationDto = {
    id: number;
    type: string;
    title: string;
    message: string;
    relatedEntityType: string | null;   // เช่น 'tournament' | 'match' — FE ใช้คู่กับ relatedEntityId สร้างลิงก์เอง
    relatedEntityId: number | null;
    isRead: boolean;
    createdAt: Date;
};

export function toNotificationDto(row: NotificationRow): NotificationDto {
    return {
        id: row.notification_id,
        type: row.type,
        title: row.title,
        message: row.message,
        relatedEntityType: row.related_entity_type,
        relatedEntityId: row.related_entity_id,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
    };
}
