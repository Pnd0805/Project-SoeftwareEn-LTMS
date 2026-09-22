import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import * as Notification from '../controllers/notification.controller.js';

// C1-ก Inbox (spec 08 §3) — mount ที่ /me · เห็น/แก้ได้เฉพาะแจ้งเตือนของตัวเอง
export const meNotificationRouter = express.Router();

meNotificationRouter.get('/notifications' , requireAuth , Notification.getMyNotifications);
meNotificationRouter.patch('/notifications/:id/read' , requireAuth , Notification.markNotificationRead);
meNotificationRouter.post('/notifications/read-all' , requireAuth , Notification.markAllNotificationsRead);
