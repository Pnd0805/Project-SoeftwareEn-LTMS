import * as z from 'zod';

// FE-nothing-validates-keys-scoredata (19 ก.ย.): คะแนนต้องไม่ติดลบ (b) · key/ผู้ชนะเช็คใน service (ต้องรู้ทีมของแมตช์) — ดู ensureScoreData
export const submitResultSchema = z.object({
    winnerTeamId : z.int(),
    scoreData : z.record(z.string() , z.int().nonnegative('คะแนนต้องไม่ติดลบ'))
});

/**
 * S03 โต้แย้งผล (มติ 26 ก.ย.) — เดิมรับแค่ reason และสตริงว่างก็ผ่าน ผู้จัดจึงได้เรื่องที่ตัดสินไม่ได้
 *   reason        บังคับ — เป็นเอกสารชิ้นเดียวที่ผู้จัด/แอดมินใช้ตัดสิน
 *   claimed*      ไม่บังคับ — ค้านบางแบบไม่ได้เถียงสกอร์ (เช่น "ผู้เล่นไม่มีสิทธิ์ลงแข่ง")
 *                 ถ้ากรอกมาต้องมาคู่กัน แล้วผู้จัดกด amend ต่อได้เลยโดยไม่ต้องพิมพ์ใหม่
 *   evidenceKeys  S3 object key ที่อัปไว้ก่อนแล้ว (purpose = dispute_evidence) สูงสุด 5 ไฟล์
 */
export const disputeSchema = z.object({
    reason : z.string().trim().min(1, 'กรุณาระบุเหตุผลที่โต้แย้ง').max(1000, 'เหตุผลยาวได้ไม่เกิน 1000 ตัวอักษร'),
    claimedWinnerTeamId : z.int().positive().optional(),
    claimedScoreData : z.record(z.string(), z.int().nonnegative('คะแนนต้องไม่ติดลบ')).optional(),
    evidenceKeys : z.array(z.string().trim().min(1).max(512)).max(5, 'แนบหลักฐานได้ไม่เกิน 5 ไฟล์').optional(),
}).refine(d => (d.claimedWinnerTeamId === undefined) === (d.claimedScoreData === undefined),
          { message : 'ถ้าเสนอผลที่ถูกต้อง ต้องระบุทั้งทีมที่ชนะและสกอร์' , path : ['claimedScoreData'] });

export type DisputeInput = z.infer<typeof disputeSchema>;

// B4 (รายงาน FE 19 ก.ย.): amend = ORG แก้ผู้ชนะ/สกอร์เองในคำตัดสิน ไม่ต้องให้ส่งใหม่
export const resolveSchema = z.object({
    resolution : z.enum(['uphold' , 'reject' , 'amend']),
    resolutionNote : z.string(),
    winnerTeamId : z.int().optional(),
    scoreData : z.record(z.string() , z.int().nonnegative('คะแนนต้องไม่ติดลบ')).optional()
}).refine(d => d.resolution !== 'amend' || (d.winnerTeamId !== undefined && d.scoreData !== undefined),
          { message : 'amend ต้องระบุ winnerTeamId และ scoreData' , path : ['winnerTeamId'] });

export type ResolveInput = z.infer<typeof resolveSchema>;

/**
 * OD-26 ข้อ 6 — ผู้จัดตัดสินแมตช์ที่แข่งแล้วแต่ไม่มีใครส่งผล (หลังพ้นกำหนดและกรรมการก็เงียบ)
 * reason บังคับเสมอ เพราะเป็นการใช้อำนาจที่ข้ามกลไกตรวจสอบปกติ (คนส่ง ≠ คนยืนยัน)
 */
export const organizerDecideSchema = z.object({
    outcome : z.enum(['result', 'double_forfeit']),
    reason : z.string().trim().min(1, 'กรุณาระบุเหตุผล').max(1000, 'เหตุผลยาวได้ไม่เกิน 1000 ตัวอักษร'),
    winnerTeamId : z.int().positive().optional(),
    scoreData : z.record(z.string(), z.int().nonnegative('คะแนนต้องไม่ติดลบ')).optional(),
}).refine(d => d.outcome !== 'result' || (d.winnerTeamId !== undefined && d.scoreData !== undefined),
          { message : 'outcome = result ต้องระบุ winnerTeamId และ scoreData' , path : ['winnerTeamId'] });

export type OrganizerDecideInput = z.infer<typeof organizerDecideSchema>;

export const statSchema = z.object({
    playerStats: z.array(
        z.object({
            userId: z.int(),
            values: z.array(
                z.object({
                    statDefinitionId: z.int(),
                    value: z.int()
                })
            )
        })
    )
});