import type { getAuditLog } from "../repositories/auditLog.repo.js";
import type { UserRefDto } from "./user.mapper.js";

export type auditLogDto = {
    id : number,
    actor : Pick<UserRefDto , 'id' | 'fullName'>,
    actionType : string,
    entityType : string,
    entityId : number,
    details : unknown,
    createdAt : string
};

export function toAuditLogDto(row : getAuditLog) : auditLogDto{
    return {
        id : row.audit_log_id,
        actor : { id : row.actor_user_id , fullName : row.actor_full_name },
        actionType : row.action_type,
        entityType : row.entity_type,
        entityId : row.entity_id,
        details : row.details,
        createdAt : row.created_at.toISOString()
    };
}
