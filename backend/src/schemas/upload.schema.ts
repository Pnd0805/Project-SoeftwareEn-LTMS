import * as z from 'zod';

export const presignUploadSchema = z.object({
    purpose: z.enum(['checkin_document', 'soft_filter_document']),
    contentType: z.enum(['image/jpeg', 'image/png']),
    matchId: z.number().optional(),
    tournamentId: z.number().optional(),
}).refine(
    (data) => data.purpose !== 'checkin_document' || data.matchId !== undefined,
    { message: 'ต้องระบุ matchId เมื่อ purpose เป็น checkin_document', path: ['matchId'] }
).refine(
    (data) => data.purpose !== 'soft_filter_document' || data.tournamentId !== undefined,
    { message: 'ต้องระบุ tournamentId เมื่อ purpose เป็น soft_filter_document', path: ['tournamentId'] }
);

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
