import * as NotificationRepo from '../repositories/notification.repo.js';
import type { NotificationInput } from '../repositories/notification.repo.js';
import { toNotificationDto } from '../mappers/notification.mapper.js';
import { AppError } from '../utils/AppError.js';
import { buildPagination } from '../utils/pagination.js';

// ---- C1-ก Inbox ของตัวเอง ----

export async function listMyNotifications(userId: number, unreadOnly: boolean, page: number, pageSize: number, offset: number) {
    const { rows, totalItems } = await NotificationRepo.findByUser(userId, unreadOnly, offset, pageSize);
    const unreadCount = await NotificationRepo.countUnread(userId);
    return {
        items: rows.map(toNotificationDto),
        unreadCount,                                   // badge กระดิ่ง — นับทั้งหมด ไม่ขึ้นกับหน้าที่ขอ
        pagination: buildPagination(page, pageSize, totalItems),
    };
}

/** ของคนอื่น = 404 (ไม่บอกว่ามีอยู่จริง) · อ่านแล้วกดซ้ำ = 200 ผลเดิม */
export async function markMyNotificationRead(notificationId: number, userId: number) {
    const notification = await NotificationRepo.findOwned(notificationId, userId);
    if (!notification) {
        throw new AppError(404, "NOTIFICATION_NOT_FOUND", "ไม่พบการแจ้งเตือนนี้");
    }
    if (!notification.is_read) {
        await NotificationRepo.markRead(notificationId, userId);
    }
    return toNotificationDto({ ...notification, is_read: 1 });
}

export async function markAllMyNotificationsRead(userId: number) {
    const updated = await NotificationRepo.markAllRead(userId);
    return { updated, unreadCount: 0 };
}

// ---- C1-ข เขียน event จาก service อื่น ----

/**
 * ส่งแจ้งเตือน — เรียก "หลัง" action สำเร็จแล้ว (ข้อเสนอในเอกสารแบ่งงาน ข้อตัดสินที่ 3)
 * แจ้งเตือนพังต้องไม่ทำให้ action ที่สำเร็จไปแล้วกลายเป็น error → กลืน error แล้ว log ไว้
 */
export async function notify(inputs: NotificationInput | NotificationInput[]): Promise<void> {
    const list = Array.isArray(inputs) ? inputs : [inputs];
    for (const input of list) {
        try {
            await NotificationRepo.insertNotification(input);
        } catch (err) {
            console.error(`[notify] ส่งแจ้งเตือน ${input.type} ให้ user ${input.userId} ไม่สำเร็จ`, err);
        }
    }
}

/** ส่งเรื่องเดียวกันให้หลายคน (ตัดคนซ้ำ) */
export async function notifyUsers(userIds: number[], content: Omit<NotificationInput, 'userId'>): Promise<void> {
    await notify([...new Set(userIds)].map(userId => ({ ...content, userId })));
}

/** ผู้เล่นในรายชื่อลงแข่งของทั้งสองทีม + กรรมการที่รับแมตช์นี้ */
export async function notifyMatchAudience(matchId: number, content: Omit<NotificationInput, 'userId'>): Promise<void> {
    try {
        await notifyUsers(await NotificationRepo.findMatchAudience(matchId), content);
    } catch (err) {
        console.error(`[notify] หาผู้รับของแมตช์ ${matchId} ไม่สำเร็จ`, err);
    }
}

/** หัวหน้าทีมทุกทีมที่ยังสมัครอยู่ในทัวร์นี้ (pending/approved) */
export async function notifyTournamentTeamLeaders(tournamentId: number, content: Omit<NotificationInput, 'userId'>): Promise<void> {
    try {
        await notifyUsers(await NotificationRepo.findTournamentTeamLeaders(tournamentId), content);
    } catch (err) {
        console.error(`[notify] หาหัวหน้าทีมของทัวร์ ${tournamentId} ไม่สำเร็จ`, err);
    }
}

/** กรรมการที่ตอบรับแล้วของทัวร์นี้ */
export async function notifyTournamentReferees(tournamentId: number, content: Omit<NotificationInput, 'userId'>): Promise<void> {
    try {
        await notifyUsers(await NotificationRepo.findTournamentReferees(tournamentId), content);
    } catch (err) {
        console.error(`[notify] หากรรมการของทัวร์ ${tournamentId} ไม่สำเร็จ`, err);
    }
}

/**
 * ผลการแข่ง: หัวหน้า 2 ทีม + กรรมการของแมตช์ (+ ORG ถ้า includeOrganizer)
 * ไม่ส่งหาคนที่เป็นคนกดเอง (exceptUserId) — เขารู้อยู่แล้ว
 */
export async function notifyMatchResultParties(
    matchId: number,
    content: Omit<NotificationInput, 'userId'>,
    options: { exceptUserId?: number; includeOrganizer?: boolean } = {}
): Promise<void> {
    try {
        const { leaderIds, refereeIds, organizerId } = await NotificationRepo.findMatchResultParties(matchId);
        const recipients = [...leaderIds, ...refereeIds, ...(options.includeOrganizer && organizerId !== null ? [organizerId] : [])]
            .filter(id => id !== options.exceptUserId);
        await notifyUsers(recipients, content);
    } catch (err) {
        console.error(`[notify] หาผู้เกี่ยวข้องกับผลแมตช์ ${matchId} ไม่สำเร็จ`, err);
    }
}

/**
 * แมตช์จบโดยไม่มีการแข่ง (ชนะบาย / แพ้ทั้งคู่ / ผ่านรอบ / แมตช์ตาย) — มติ 22 ก.ย. 2569
 * สมาชิก "ทุกคน" ของทีมที่เกี่ยว + กรรมการที่รับแมตช์นี้ (ไม่ต้องมาแล้ว) + ORG · ไม่ส่งหาคนที่กดเอง (exceptUserId)
 */
export async function notifyMatchDecidedWithoutPlay(
    matchId: number,
    teamIds: number[],
    content: Omit<NotificationInput, 'userId'>,
    options: { exceptUserId?: number } = {}
): Promise<void> {
    try {
        const memberIds = await NotificationRepo.findTeamMemberIds(teamIds);
        const { refereeIds, organizerId } = await NotificationRepo.findMatchResultParties(matchId);
        const recipients = [...memberIds, ...refereeIds, ...(organizerId !== null ? [organizerId] : [])]
            .filter(id => id !== options.exceptUserId);
        await notifyUsers(recipients, content);
    } catch (err) {
        console.error(`[notify] หาผู้รับของแมตช์ที่จบโดยไม่มีการแข่ง ${matchId} ไม่สำเร็จ`, err);
    }
}
