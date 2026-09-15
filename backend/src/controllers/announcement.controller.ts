import type { Request, Response } from 'express';
import * as AnnouncementService from '../services/announcement.service.js';
import { parseId } from '../utils/parseId.js';
import { parsePagination } from '../utils/pagination.js';

export async function createAnnouncement(req : Request , res : Response){
    const tournamentId = parseId(req.params['id'] , 'รหัสทัวร์นาเมนต์' , 'id');
    const userId = req.user!.user_id;
    const title = req.body['title'];
    const body = req.body['body'];
    return res.status(201).json(await AnnouncementService.createAnnouncement(tournamentId , title , body , userId));
}

export async function listAnnouncements(req : Request , res : Response){
    const tournamentId = parseId(req.params['id'] , 'รหัสทัวร์นาเมนต์' , 'id');
    const { newpage , newpageSize , offset } = parsePagination(req.query['page'] , req.query['pageSize']);
    return res.status(200).json(await AnnouncementService.listAnnouncements(tournamentId , offset , newpage , newpageSize));
}

export async function updateAnnouncement(req : Request , res : Response){
    const announcementId = parseId(req.params['id'] , 'รหัสประกาศ' , 'id');
    const userId = req.user!.user_id;
    const title = req.body['title'];
    const body = req.body['body'];
    return res.status(200).json(await AnnouncementService.updateAnnouncement(announcementId , { title , body } , userId));
}

export async function deleteAnnouncement(req : Request , res : Response){
    const announcementId = parseId(req.params['id'] , 'รหัสประกาศ' , 'id');
    const userId = req.user!.user_id;
    await AnnouncementService.deleteAnnouncement(announcementId , userId);
    return res.status(204).send();
}
