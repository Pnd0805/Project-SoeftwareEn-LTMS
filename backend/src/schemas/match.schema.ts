import * as z from 'zod';

export const livestreamSchema = z.object({
    youtubeUrl : z.string()
});
