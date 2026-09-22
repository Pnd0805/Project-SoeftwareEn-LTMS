import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';
import { parsePagination } from '../utils/pagination.js';
import * as NotificationService from '../services/notification.service.js';

export async function getMyNotifications(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const { newpage, newpageSize, offset } = parsePagination(req.query['page'], req.query['pageSize']);
    const unreadOnly = req.query['unread'] === 'true';
    res.status(200).json(await NotificationService.listMyNotifications(req.user.user_id, unreadOnly, newpage, newpageSize, offset));
}

export async function markNotificationRead(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const notificationId = parseId(req.params['id'], 'รหัสการแจ้งเตือน');
    res.status(200).json(await NotificationService.markMyNotificationRead(notificationId, req.user.user_id));
}

export async function markAllNotificationsRead(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    res.status(200).json(await NotificationService.markAllMyNotificationsRead(req.user.user_id));
}
