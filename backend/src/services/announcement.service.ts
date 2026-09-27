import * as AnnouncementRepo from '../repositories/announcement.repo.js';
import { toAnnouncementDto } from '../mappers/announcement.mapper.js';
import { buildPagination } from '../utils/pagination.js';
import { checkAnnouncement } from '../utils/checkExist.js';
import type { AnnouncementRow } from '../types/db.js';

export async function createAnnouncement(tournamentId : number , title : string , body : string , userId : number ,
                                         type : AnnouncementRow['announcement_type'] = 'general'){
    const id = await AnnouncementRepo.create(tournamentId , title , body , userId , type);
    const row = await checkAnnouncement(id);
    return toAnnouncementDto(row);
}

export async function listAnnouncements(tournamentId : number , offset : number , page : number , pageSize : number){
    const { rows, totalItems } = await AnnouncementRepo.findByTournament(tournamentId , offset , pageSize);
    return {
        items : rows.map(toAnnouncementDto),
        pagination : buildPagination(page , pageSize , totalItems)
    };
}

export async function updateAnnouncement(announcementId : number ,
                                         changes : { title? : string , body? : string , type? : AnnouncementRow['announcement_type'] } ,
                                         userId : number){
    const repoChanges : { title? : string , content? : string , type? : AnnouncementRow['announcement_type'] } = {};
    if(changes.title !== undefined) repoChanges.title = changes.title;
    if(changes.body !== undefined) repoChanges.content = changes.body;
    if(changes.type !== undefined) repoChanges.type = changes.type;

    await AnnouncementRepo.update(announcementId , repoChanges , userId);
    const row = await checkAnnouncement(announcementId);
    return toAnnouncementDto(row);
}

export async function deleteAnnouncement(announcementId : number , userId : number){
    await AnnouncementRepo.softDelete(announcementId , userId);
}
