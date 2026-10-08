import * as z from 'zod';

const id = (label : string) => z.int(`${label}ต้องเป็นจำนวนเต็ม`).positive(`กรุณาระบุ${label}`);

/** FR01 — REF ขอโอน (ไม่ส่ง theirMatchId) หรือแลก (ส่ง theirMatchId) แมตช์กับกรรมการอีกคน */
export const refRequestSchema = z.object({
    myMatchId : id('แมตช์ของคุณ'),
    toTournamentRefereeId : id('กรรมการที่ต้องการโอน/แลกด้วย'),
    theirMatchId : id('แมตช์ของอีกฝ่าย').optional()
});

/** FR02 — ORG ขอให้กรรมการรับแมตช์เพิ่ม */
export const orgAddMatchSchema = z.object({
    tournamentRefereeId : id('รหัสกรรมการ'),
    matchId : id('รหัสแมตช์')
});

/** FR03 — ORG ขอสลับแมตช์ระหว่างกรรมการ 2 คน */
export const orgSwapSchema = z.object({
    refereeAId : id('รหัสกรรมการ A'),
    matchAId : id('แมตช์ของ A'),
    refereeBId : id('รหัสกรรมการ B'),
    matchBId : id('แมตช์ของ B')
});

/**
 * FR09 — กรรมการขอถอนตัว (มติ 6 ต.ค. 2569)
 *
 * ★ สองขอบเขตในสคีมาเดียว แต่ **บังคับคีย์ไม่เหมือนกัน** จึงใช้ discriminated union
 *   ไม่ใช่ object ที่ทุกคีย์ optional ซึ่งจะยอมรับ { scope:'match' } ที่ไม่มี matchId
 *   แล้วไปพังที่ service แทน (หรือแย่กว่านั้น ไปพังที่ฐาน)
 *
 * เหตุผล **บังคับ** ทั้งสองขอบเขต — ORG ตัดสินใจไม่ได้ถ้าไม่รู้ว่าเพราะอะไร
 * และเขาคือคนที่ต้องไปหาคนแทน
 */
export const refWithdrawSchema = z.discriminatedUnion('scope', [
    z.object({
        scope : z.literal('match'),
        matchId : id('รหัสแมตช์'),
        reason : z.string().trim().min(5, 'กรุณาเขียนเหตุผลอย่างน้อย 5 ตัวอักษร').max(500, 'เหตุผลยาวเกิน 500 ตัวอักษร')
    }),
    z.object({
        scope : z.literal('tournament'),
        tournamentId : id('รหัสทัวร์นาเมนต์'),
        reason : z.string().trim().min(5, 'กรุณาเขียนเหตุผลอย่างน้อย 5 ตัวอักษร').max(500, 'เหตุผลยาวเกิน 500 ตัวอักษร')
    })
]);

export type RefRequestInput = z.infer<typeof refRequestSchema>;
export type OrgAddMatchInput = z.infer<typeof orgAddMatchSchema>;
export type OrgSwapInput = z.infer<typeof orgSwapSchema>;
export type RefWithdrawInput = z.infer<typeof refWithdrawSchema>;
