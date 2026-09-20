import * as z from 'zod';

export const submitResultSchema = z.object({
    winnerTeamId : z.int(),
    scoreData : z.record(z.string() , z.int())
});

export const disputeSchema = z.object({
    reason : z.string()
});

// B4 (รายงาน FE 19 ก.ย.): amend = ORG แก้ผู้ชนะ/สกอร์เองในคำตัดสิน ไม่ต้องให้ส่งใหม่
export const resolveSchema = z.object({
    resolution : z.enum(['uphold' , 'reject' , 'amend']),
    resolutionNote : z.string(),
    winnerTeamId : z.int().optional(),
    scoreData : z.record(z.string() , z.int()).optional()
}).refine(d => d.resolution !== 'amend' || (d.winnerTeamId !== undefined && d.scoreData !== undefined),
          { message : 'amend ต้องระบุ winnerTeamId และ scoreData' , path : ['winnerTeamId'] });

export type ResolveInput = z.infer<typeof resolveSchema>;

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