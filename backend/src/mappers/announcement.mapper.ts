import type { AnnouncementRow } from "../types/db.js";

export type announcementDto = {
    id : number,
    title : string,
    body : string,
    createdAt : string
};

export function toAnnouncementDto(row : AnnouncementRow) : announcementDto{
    return {
        id : row.announcement_id,
        title : row.title,
        body : row.content,
        createdAt : row.created_at.toISOString()
    };
}
