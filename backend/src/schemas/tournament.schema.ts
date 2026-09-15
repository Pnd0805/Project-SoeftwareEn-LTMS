import * as z from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD');
const dateTime = z.iso.datetime({ offset: true });
const optionalId = z.int().positive().nullable().optional();
const optionalAge = z.int().min(0).max(120).nullable().optional();

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
    maxAge: optionalAge
});

export const updateTournamentSchema = z.object({
    venue: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(255).nullable().optional()
}).passthrough();

export const amendmentRequestSchema = z.object({
    requestedChanges: z.record(z.string(), z.unknown()).refine(value => Object.keys(value).length > 0, {
        message: 'กรุณาระบุข้อมูลที่ต้องการขอแก้ไข'
    })
});

export const rejectTournamentSchema = z.object({
    reason: z.string().trim().min(1)
});

export const amendmentRejectSchema = rejectTournamentSchema;

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type AmendmentRequestInput = z.infer<typeof amendmentRequestSchema>;
