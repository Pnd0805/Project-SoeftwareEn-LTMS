/**
 * ชิ้นส่วนของ "แถวที่ JOIN users มาแล้ว" สำหรับเทส — มติ 6 ต.ค. 2569 (ทางเลือก ค)
 *
 * ═══ ปัญหาที่แก้ ═══
 * เวลาต้องแสดงชื่อคนคู่กับข้อมูลอื่น repository จะ JOIN ตาราง users มาด้วย
 * ⇒ แถวที่ได้มีสามคีย์นี้ติดมาทุกครั้ง: user_id · full_name · profile_image_key
 * ชนิดใน production ที่เขียนสามคีย์ชุดนี้ซ้ำกันเป๊ะ ๆ มี 11 ที่ (6 ต.ค.):
 *   team.repo(getInvitation) · user.repo(MyInvitationRow, searchByName)
 *   tournament.repo(3 ที่) · tournamentReferee.repo · matchReferee.repo
 *   joinRequest.repo · team.mapper(TeamMemberWithUserRef) · user.mapper(toUserRef)
 *   adminScope.mapper
 *
 * แต่ในเทส คนปลอมแถวขึ้นมาเอง แล้วลืมสามคีย์นี้ ⇒ tsc ฟ้องว่าไม่ใช่แถวที่ JOIN แล้ว
 *
 * 🔴 สิ่งที่เสียไม่ใช่ "คอมไพล์ไม่ผ่าน" แต่คือ **เทสทดสอบสถานการณ์ที่ไม่มีทางเกิด**
 *   ของจริงมี full_name ทุกครั้ง ⇒ ถ้าโค้ดพังเฉพาะตอน full_name มีค่า เทสจะไม่จับ
 *   (เกิดไปแล้วรอบหนึ่งกับ LiveSquadRow.status — mock ขาดคีย์ ⇒ undefined ⇒ เทสที่ทุกคน
 *    คิดว่าวัดสาขา 'approved' จริง ๆ วัดสาขา 'pending' มาเป็นเดือน · ดู fa9e2b9)
 *
 * ═══ ทำไมเป็น "ชิ้นส่วนสามคีย์" ไม่ใช่ fixture ของแถวทั้งแถว ═══
 * แถวที่ JOIN แล้วหน้าตาไม่เหมือนกันทั้งหมด — MyInvitationRow มี Pick<TeamRow> ติดมาด้วย
 * JoinRequestWithUser เป็น TeamJoinRequestRow & … และไม่มี user_id เลย
 * ⇒ fixture ตัวเดียวครอบทุกแถวไม่ได้ จะกลายเป็นของหลายตัวที่ต้องดูแลทั้งหมด
 * ⇒ เก็บเฉพาะ **ส่วนที่ซ้ำกันจริง** แล้วให้แต่ละเทส spread ของตัวเองเพิ่ม
 *
 *     vi.mocked(TeamRepo.findMembers).mockResolvedValue([
 *         { ...baseMemberRow, ...userRef({ user_id: 9, full_name: 'สมชาย' }) }
 *     ]);
 *
 * ★ ใช้ Partial ไม่ใช่ Overrides<T> (helpers/overrides.ts) โดยเจตนา
 *   Overrides ยอมให้ส่งค่า undefined มาทับได้ ซึ่งถูกสำหรับ req.user ที่ "ไม่ได้ล็อกอิน"
 *   แต่ผิดสำหรับที่นี่ — แถวที่ JOIN แล้วไม่มีทางมี full_name เป็น undefined
 *   ⇒ ถ้าเทสไหนอยากทดสอบแถวที่ขาดคีย์ ต้องเขียนออกมาให้เห็นชัด ไม่ใช่ผ่านตัวช่วยนี้
 */
import type { UserRow, TeamRow } from '../../types/db.js';

/** สามคีย์ที่ติดมาทุกครั้งที่ JOIN users — ชุดเดียวกับที่ production เขียนซ้ำ 11 ที่ */
export type UserRefCols = Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

/**
 * ★ profile_image_key ตั้งต้นเป็น null เพราะ "ยังไม่ได้อัปโลโก้/รูป" คือสภาพของ **ทุกแถวในฐานจริง**
 *   ตอนนี้ (ยังไม่มีใครอัปเลย) ⇒ ไม่ได้เลือกเพื่อให้คอมไพล์ผ่าน แต่เพราะมันคือค่าที่ของจริงเป็น
 * 🙋 เทสที่ต้องการวัดเส้น toPublicImageUrl ให้ส่งค่าจริงมาทับ: userRef({ profile_image_key: 'avatar/1.png' })
 */
export function userRef(overrides: Partial<UserRefCols> = {}): UserRefCols {
    return {
        user_id : 1,
        full_name : 'ผู้ใช้ทดสอบ',
        profile_image_key : null,
        ...overrides
    };
}

/**
 * ชิ้นส่วน "ทีมแบบย่อ" ที่ติดมาเวลา JOIN teams — ชุดเดียวกับที่ production เขียนซ้ำ 6 ที่ (6 ต.ค.):
 *   team.mapper(toTeamRef) · adminScope.mapper(2 ที่) · application.repo(findApprovedTeamsByTournament)
 *   matchResult.repo(StandingRow) · user.repo(MyInvitationRow)
 *
 * ★ เติมตัวนี้เพราะ MyInvitationRow ต้องการทั้งสองชุด (user + team) ⇒ userRef() ตัวเดียวปิดไม่ได้
 *   ซึ่งเป็นกรณีที่คอมเมนต์หัวไฟล์เตือนไว้แล้วว่า "แถวที่ JOIN แล้วหน้าตาไม่เหมือนกันทั้งหมด"
 *   ⇒ ไม่ได้ขยายขอบเขตไปทำ fixture ของแถวทั้งแถว ยังเป็นชิ้นส่วนที่ซ้ำกันจริงเหมือนเดิม
 *
 * 🔴 logo_key ตั้งต้นเป็น null ด้วยเหตุผลเดียวกับ profile_image_key — ยังไม่มีทีมไหนในฐานอัปโลโก้เลย
 */
export type TeamRefCols = Pick<TeamRow, 'team_id' | 'name' | 'sport_type_id' | 'logo_key'>;

export function teamRef(overrides: Partial<TeamRefCols> = {}): TeamRefCols {
    return {
        team_id : 1,
        name : 'ทีมทดสอบ',
        sport_type_id : 1,
        logo_key : null,
        ...overrides
    };
}
