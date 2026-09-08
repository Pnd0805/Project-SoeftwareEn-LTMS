import * as z from 'zod';

export const updateMeSchema = z.object({
   avatarUrl : z.string().optional(),
   contactInfo : z.string().optional(),
   address : z.string().optional()
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;