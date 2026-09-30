import * as z from 'zod';

export const updateMeSchema = z.object({
   avatarUrl : z.string().max(512).nullable().optional(),   // เดิมหลวมเกินไป (z.string().optional()) — FE-avatar-and-team-logo-uploads
   contactInfo : z.string().optional(),
   address : z.string().optional()
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;