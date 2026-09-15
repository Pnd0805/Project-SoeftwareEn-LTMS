import * as z from 'zod';

export const submitResultSchema = z.object({
    winnerTeamId : z.int(),
    scoreData : z.record(z.string() , z.int())
});

export const disputeSchema = z.object({
    reason : z.string()
});

export const resolveSchema = z.object({
    resolution : z.enum(['uphold' , 'reject']),
    resolutionNote : z.string()
});

export const statSchema = z.object({
    playerStats: z.array(
        z.object({
            userId: z.int(),
            values: z.array(
                z.object({
                    statDefinitionId: z.int(),
                    value: z.int()
                })
            )
        })
    )
});