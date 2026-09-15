import * as z from 'zod';

export const createAnnouncementSchema = z.object({
    title : z.string(),
    body : z.string()
});

export const updateAnnouncementSchema = z.object({
    title : z.string().optional(),
    body : z.string().optional()
});
