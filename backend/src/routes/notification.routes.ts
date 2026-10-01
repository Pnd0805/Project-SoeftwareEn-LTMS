import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { notificationPrefsSchema } from '../schemas/notification.schema.js';
import * as Notification from '../controllers/notification.controller.js';

// C1-ก Inbox (spec 08 §3) — mount ที่ /me · เห็น/แก้ได้เฉพาะแจ้งเตือนของตัวเอง
export const meNotificationRouter = express.Router();

meNotificationRouter.get('/notifications' , requireAuth , Notification.getMyNotifications);
meNotificationRouter.patch('/notifications/:id/read' , requireAuth , Notification.markNotificationRead);
meNotificationRouter.post('/notifications/read-all' , requireAuth , Notification.markAllNotificationsRead);

// OD-43 ตั้งค่าแจ้งเตือนรายหมวด — แยกเส้นจาก /notifications ตั้งใจ ไม่ให้ 'prefs' ไปชนกับ '/notifications/:id/read'
meNotificationRouter.get('/notification-prefs' , requireAuth , Notification.getMyNotificationPrefs);
meNotificationRouter.patch('/notification-prefs' , requireAuth , validate(notificationPrefsSchema) , Notification.updateMyNotificationPrefs);
