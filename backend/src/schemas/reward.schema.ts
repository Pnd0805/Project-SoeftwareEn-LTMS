import { z } from 'zod';

export const updateRewardDisplaySchema = z.object({
    isDisplayed: z.boolean(),
});
