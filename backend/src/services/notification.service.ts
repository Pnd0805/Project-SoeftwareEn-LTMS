import * as NotificationRepo from '../repositories/notification.repo.js';
import { queueNotificationEmail } from './emailNotification.service.js';
import * as UserRepo from '../repositories/user.repo.js';
import { MUTABLE_CATEGORIES, mutedTypes, resolvePrefs } from '../config/notificationCategories.js';
import type { MutableCategory } from '../config/notificationCategories.js';
import type { NotificationInput } from '../repositories/notification.repo.js';
import { toNotificationDto } from '../mappers/notification.mapper.js';
import { AppError } from '../utils/AppError.js';
import { buildPagination } from '../utils/pagination.js';

// ---- C1-ก Inbox ของตัวเอง ----

/**
 * OD-43 — หมวดที่ผู้ใช้ปิดไว้จะไม่โผล่ในกล่องและไม่ถูกนับในกระดิ่ง
 *   `includeMuted = true` เปิดดูย้อนหลังได้ (สเปค 08 §3 ห้ามลบ history ทิ้ง)
 *   ★ `unreadCount` ใช้ลิสต์ที่ปิดไว้ **เสมอ** ไม่ขึ้นกับ includeMuted — กระดิ่งคือ "ของที่คุณสนใจและยังไม่อ่าน"
 *     ถ้าปล่อยให้เลขกระพริบตาม query ผู้ใช้จะเห็นเลขเด้งไปมาโดยไม่มีอะไรเปลี่ยนจริง
 */
export async function listMyNotifications(
    userId: number, unreadOnly: boolean, page: number, pageSize: number, offset: number, includeMuted = false
) {
    const muted = mutedTypes(await UserRepo.findNotificationPrefs(userId));
    const excluded = includeMuted ? [] : muted;

    const { rows, totalItems } = await NotificationRepo.findByUser(userId, unreadOnly, offset, pageSize, excluded);
    const unreadCount = await NotificationRepo.countUnread(userId, muted);
    return {
        items: rows.map(toNotificationDto),
        unreadCount,                                   // badge กระดิ่ง — นับทั้งหมด ไม่ขึ้นกับหน้าที่ขอ
        pagination: buildPagination(page, pageSize, totalItems),
    };
}

// ---- C1-ค ตั้งค่าแจ้งเตือนรายหมวด (OD-43) ----

/**
 * คืนทุกหมวดพร้อมธง `locked` — FE จะได้ไม่ต้อง hardcode รายชื่อหมวดเอง
 * เพิ่มหมวดใหม่ทีหลังแล้วหน้าตั้งค่าโผล่ให้เอง ไม่ต้องรอ FE แก้ตาม
 */
export async function getMyNotificationPrefs(userId: number) {
    const prefs = resolvePrefs(await UserRepo.findNotificationPrefs(userId));
    return {
        categories: [
            { key: 'critical', enabled: true, locked: true },   // เรื่องที่มีเส้นตาย — ปิดไม่ได้ ดูเหตุผลใน config/notificationCategories.ts
            ...MUTABLE_CATEGORIES.map(key => ({ key, enabled: prefs[key], locked: false })),
        ],
    };
}

/** PATCH = ส่งมาเฉพาะหมวดที่อยากเปลี่ยน · ที่ไม่ส่งมาคงค่าเดิม · `critical` ถูกกันตั้งแต่ชั้น schema แล้ว */
export async function updateMyNotificationPrefs(userId: number, input: Partial<Record<MutableCategory, boolean>>) {
    const current = resolvePrefs(await UserRepo.findNotificationPrefs(userId));
    const updated = await UserRepo.updateNotificationPrefs(userId, { ...current, ...input });
    if (updated === 0) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้");
    }
    return getMyNotificationPrefs(userId);
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
            const notificationId = await NotificationRepo.insertNotification(input);
            try {
                await queueNotificationEmail(notificationId, input.userId, input.type);
            } catch (err) {
                // An email failure must never undo the in-app notification or user action.
                console.error(`[notify] คิวอีเมลไม่สำเร็จสำหรับ notification ${notificationId}`, err);
            }
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

/**
 * OD-72 (FR-FN-02 · UC-05 ขั้น 5) — ผู้ติดตามนักกีฬาในแมตช์นี้ที่เปิดกระดิ่งไว้
 *
 * ★ ตัดคนที่ "ได้ข่าวเรื่องเดียวกันผ่านชนิดของตัวเองอยู่แล้ว" ออก ⇒ ไม่ตัด = เรื่องเดียวกันสองฉบับคนละชนิด
 * 🔴 แก้ 30 ต.ค. 2569 (FR-FN-02 · ฝ่ายเอกสารตรวจเจอ) — **สองจังหวะมีผู้รับ "ของตัวเอง" ไม่เท่ากัน จึงตัดไม่เท่ากัน**
 *   เดิมตัดชุดเดียวกันทั้งสองจังหวะ (ผู้เล่น + หัวหน้า + กรรมการ) ซึ่งถูกเฉพาะจังหวะแมตช์เริ่ม
 *   ⇒ ตอนผลยืนยัน ผู้เล่นธรรมดาที่ลงแข่งและติดตามเพื่อนอยู่ **ไม่ได้อะไรเลย** — ถูกตัดเพราะ "ถือว่าได้ของตัวเองแล้ว"
 *      ทั้งที่ notifyMatchResultParties ส่งแค่หัวหน้าทีม + กรรมการ ไม่ได้ส่งผู้เล่น
 *
 *   | จังหวะ                 | excludeAudience | ตัดออก                                   | เพราะได้ข่าวผ่าน              |
 *   | แมตช์เริ่ม (startMatch) | true            | ผู้เล่นในรายชื่อ · หัวหน้าทีม · กรรมการ  | notifyMatchAudience (+หัวหน้า) |
 *   | ผลยืนยัน (มือ/อัตโนมัติ) | false           | หัวหน้าทีม · กรรมการ                     | notifyMatchResultParties      |
 *
 *   ★ ให้ผู้เรียกบอกเอง (บังคับส่ง ไม่มีค่าตั้งต้น) — จุดยิงใหม่ในอนาคตต้องคิดว่าผู้รับชุดเดิมของจังหวะนั้นคือใคร
 * ★ ไม่แตะผู้รับชุดเดิมของ notifyMatchAudience / notifyMatchResultParties เลย
 * ★ กลืน error เหมือนตัวอื่นในไฟล์ — การเริ่มแข่ง/ยืนยันผลต้องไม่ล้มเพราะหาผู้ติดตามไม่สำเร็จ
 */
export async function notifyMatchFollowers(
    matchId: number,
    content: Omit<NotificationInput, 'userId'>,
    options: { excludeAudience: boolean }
): Promise<void> {
    try {
        const [followers, audience, parties] = await Promise.all([
            NotificationRepo.findMatchFollowers(matchId),
            options.excludeAudience ? NotificationRepo.findMatchAudience(matchId) : Promise.resolve([] as number[]),
            NotificationRepo.findMatchResultParties(matchId),
        ]);
        const involved = new Set([...audience, ...parties.leaderIds, ...parties.refereeIds]);
        await notifyUsers(followers.filter(id => !involved.has(id)), content);
    } catch (err) {
        console.error(`[notify] หาผู้ติดตามของแมตช์ ${matchId} ไม่สำเร็จ`, err);
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

/** ผู้เล่นในรายชื่อลงแข่ง + หัวหน้าทีม ของทุกทีมที่ผ่านในทัวร์นี้ · ไม่ส่งหาคนที่กดเอง */
export async function notifyTournamentSquads(
    tournamentId: number,
    content: Omit<NotificationInput, 'userId'>,
    options: { exceptUserId?: number } = {}
): Promise<void> {
    try {
        const recipients = (await NotificationRepo.findTournamentSquadsAndLeaders(tournamentId)).filter(id => id !== options.exceptUserId);
        await notifyUsers(recipients, content);
    } catch (err) {
        console.error(`[notify] หาผู้เล่นของทัวร์ ${tournamentId} ไม่สำเร็จ`, err);
    }
}

/**
 * สมาชิก "ทุกคน" ของทีม + หัวหน้าทีม — ใช้กับ event ที่เป็นเรื่องของ**ทีม** ไม่ใช่ของแมตช์
 * (ถอนตัวจากทัวร์) ⇒ ต้องถึงสมาชิกที่ไม่ได้อยู่ในรายชื่อลงแข่งด้วย ซึ่ง notifyTournamentSquads ไม่ครอบ
 */
export async function notifyTeamMembers(
    teamIds: number[],
    content: Omit<NotificationInput, 'userId'>,
    options: { exceptUserId?: number } = {}
): Promise<void> {
    try {
        const recipients = (await NotificationRepo.findTeamMemberIds(teamIds)).filter(id => id !== options.exceptUserId);
        await notifyUsers(recipients, content);
    } catch (err) {
        console.error(`[notify] หาสมาชิกของทีม ${teamIds.join(',')} ไม่สำเร็จ`, err);
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
