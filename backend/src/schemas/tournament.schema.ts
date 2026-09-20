import * as z from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD');
const dateTime = z.iso.datetime({ offset: true });
const optionalId = z.int().positive().nullable().optional();
const optionalAge = z.int().min(0).max(120).nullable().optional();

// กฎคุณสมบัติ (มติ 20 ก.ย. 2569 Q1-ค): faculty = รหัสคณะที่รับ · year = ชั้นปีที่รับ (1–8) · ไม่ส่ง/ว่าง = ไม่จำกัด
export const eligibilityRuleSchema = z.object({
    type: z.enum(['faculty', 'year']),
    value: z.int().positive()
});
export const eligibilityRulesSchema = z.array(eligibilityRuleSchema).max(50);
export const setEligibilityRulesSchema = z.object({ rules: eligibilityRulesSchema });

export const createTournamentSchema = z.object({
    name: z.string().trim().min(1).max(200),
    sportTypeId: z.int().positive(),
    bracketFormat: z.enum(['single_elimination', 'double_elimination', 'round_robin']),
    scopeType: z.enum(['department', 'faculty']),
    organizingFacultyId: optionalId,
    organizingDepartmentId: optionalId,
    registrationStart: dateTime,
    registrationEnd: dateTime,
    eventStartDate: dateOnly,
    eventEndDate: dateOnly,
    maxTeams: z.int().min(2),
    minTeams: z.int().min(2),
    venue: z.string().trim().min(1).max(255),
    genderRequirement: z.enum(['any', 'male', 'female']),
    minAge: optionalAge,
    maxAge: optionalAge,
    eligibilityRules: eligibilityRulesSchema.optional()
});

export const updateTournamentSchema = z.object({
    venue: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(255).nullable().optional()
}).passthrough();

export const amendmentRequestSchema = z.object({
    requestedChanges: z.record(z.string(), z.unknown()).refine(value => Object.keys(value).length > 0, {
        message: 'กรุณาระบุข้อมูลที่ต้องการขอแก้ไข'
    }),
    // เหตุผลของผู้ขอ — บังคับ (มติ 20 ก.ย. FE-change-request-has-nowhere) ให้แอดมินมีเรื่องประกอบการพิจารณา
    reason: z.string().trim().min(1, 'กรุณาระบุเหตุผลที่ขอแก้ไข').max(1000)
});

export const rejectTournamentSchema = z.object({
    reason: z.string().trim().min(1)
});

export const amendmentRejectSchema = rejectTournamentSchema;

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type AmendmentRequestInput = z.infer<typeof amendmentRequestSchema>;
export type EligibilityRuleInput = z.infer<typeof eligibilityRuleSchema>;
export type SetEligibilityRulesInput = z.infer<typeof setEligibilityRulesSchema>;
