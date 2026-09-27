import * as z from 'zod';

/**
 * OD-26 ข้อ 8 (มติ 26–27 ก.ย. 2569) — ยื่นเรื่องร้องเรียนผลแมตช์
 *
 * รูปร่างเหมือน disputeSchema โดยตั้งใจ: คนยื่นไม่ต้องเรียนฟอร์มใหม่ และถ้าเสนอผลที่ถูกต้องมาด้วย
 * แอดมินกด "แก้ผล" ต่อได้เลยโดยไม่ต้องพิมพ์ซ้ำ · ไฟล์หลักฐานใช้ purpose `dispute_evidence` ตัวเดิม
 */
export const fileComplaintSchema = z.object({
    reason : z.string().trim().min(1, 'กรุณาระบุเหตุผลที่ร้องเรียน').max(1000, 'เหตุผลยาวได้ไม่เกิน 1000 ตัวอักษร'),
    claimedWinnerTeamId : z.int().positive().optional(),
    claimedScoreData : z.record(z.string(), z.int().nonnegative('คะแนนต้องไม่ติดลบ')).optional(),
    evidenceKeys : z.array(z.string().trim().min(1).max(512)).max(5, 'แนบหลักฐานได้ไม่เกิน 5 ไฟล์').optional(),
}).refine(d => (d.claimedWinnerTeamId === undefined) === (d.claimedScoreData === undefined),
          { message : 'ถ้าเสนอผลที่ถูกต้อง ต้องระบุทั้งทีมที่ชนะและสกอร์' , path : ['claimedScoreData'] });

export type FileComplaintInput = z.infer<typeof fileComplaintSchema>;

/** ผู้จัดแนบความเห็น — ไม่มีตัวเลือก "ปัดตก" โดยเจตนา (มติ 26 ก.ย.) */
export const organizerStatementSchema = z.object({
    statement : z.string().trim().min(1, 'กรุณาเขียนความเห็น').max(2000, 'ความเห็นยาวได้ไม่เกิน 2000 ตัวอักษร'),
});

export type OrganizerStatementInput = z.infer<typeof organizerStatementSchema>;

/**
 * แอดมินตัดสิน (มติ 27 ก.ย.)
 *   outcome  upheld = มีมูล · no_merit = ไม่มีมูล (บันทึกชื่อผู้ยื่น)
 *   remedy   record_only = บันทึกไว้เป็นหลักฐานอย่างเดียว · amend_result = แก้ผลจริงด้วย
 *            แอดมินเลือกเอง เพราะเป็นคนเดียวที่เห็นว่าสายเดินไปไกลแค่ไหน — บังคับแก้หรือบังคับไม่แก้
 *            ทั้งสองทางมีเคสที่พัง · amend_result ใช้ได้เฉพาะเมื่อผลยังแก้ได้ (แมตช์ถัดไปยังไม่ขยับ)
 */
export const decideComplaintSchema = z.object({
    outcome : z.enum(['upheld' , 'no_merit']),
    remedy : z.enum(['record_only' , 'amend_result']).default('record_only'),
    note : z.string().trim().min(1, 'กรุณาระบุคำวินิจฉัย').max(2000, 'คำวินิจฉัยยาวได้ไม่เกิน 2000 ตัวอักษร'),
    winnerTeamId : z.int().positive().optional(),
    scoreData : z.record(z.string(), z.int().nonnegative('คะแนนต้องไม่ติดลบ')).optional(),
}).refine(d => d.remedy !== 'amend_result' || (d.winnerTeamId !== undefined && d.scoreData !== undefined),
          { message : 'remedy = amend_result ต้องระบุ winnerTeamId และ scoreData' , path : ['winnerTeamId'] })
  .refine(d => d.outcome === 'upheld' || d.remedy === 'record_only',
          { message : 'เรื่องที่ไม่มีมูลแก้ผลการแข่งขันไม่ได้' , path : ['remedy'] });

export type DecideComplaintInput = z.infer<typeof decideComplaintSchema>;
