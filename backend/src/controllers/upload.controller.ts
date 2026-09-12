import type { Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import * as UploadService from '../services/upload.service.js';

export async function presignUpload(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const result = await UploadService.createPresignedUpload(req.body);
    res.status(200).json(result);
}
