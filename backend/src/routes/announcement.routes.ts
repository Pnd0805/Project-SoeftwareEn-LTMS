import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireOrganizer, requireOrganizerOfAnnouncement } from '../middlewares/requireOrganizer.js';
import { validate } from '../middlewares/validate.js';
import { createAnnouncementSchema, updateAnnouncementSchema } from '../schemas/announcement.schema.js';
import * as Announcement from '../controllers/announcement.controller.js';

export const tournamentAnnouncementRouter = express.Router();
export const announcementRouter = express.Router();

// E08
tournamentAnnouncementRouter.post('/:id/announcements',
    requireAuth, requireOrganizer, validate(createAnnouncementSchema), Announcement.createAnnouncement);

// E09 — สาธารณะ ไม่มี middleware
tournamentAnnouncementRouter.get('/:id/announcements', Announcement.listAnnouncements);

// E10
announcementRouter.patch('/:id',
    requireAuth, requireOrganizerOfAnnouncement, validate(updateAnnouncementSchema), Announcement.updateAnnouncement);

// E11
announcementRouter.delete('/:id',
    requireAuth, requireOrganizerOfAnnouncement, Announcement.deleteAnnouncement);
