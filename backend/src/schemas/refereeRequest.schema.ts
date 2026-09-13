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

export type RefRequestInput = z.infer<typeof refRequestSchema>;
export type OrgAddMatchInput = z.infer<typeof orgAddMatchSchema>;
export type OrgSwapInput = z.infer<typeof orgSwapSchema>;
