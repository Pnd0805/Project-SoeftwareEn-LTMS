import type { getUserReport } from "../repositories/userReport.repo.js";
import type { UserRefDto } from "./user.mapper.js";

export type userReportDto = {
    id : number,
    reporter : UserRefDto,
    target : UserRefDto & { isAdmin : boolean },
    reason : string,
    evidence : string[],
    status : 'pending' | 'approved' | 'rejected',
    createdAt : string
};

export function toUserReportDto(row : getUserReport) : userReportDto{
    return {
        id : row.user_report_id,
        reporter : { id : row.reporter_id , fullName : row.reporter_name , avatarUrl : null },
        target : { id : row.target_id , fullName : row.target_name , avatarUrl : null , isAdmin : row.target_is_admin === 1 },
        reason : row.reason,
        evidence : row.evidence ?? [],
        status : row.user_report_status,
        createdAt : row.created_at.toISOString()
    };
}
