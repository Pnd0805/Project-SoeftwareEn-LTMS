import type {Request , Response} from 'express';
import { toMeDto } from "../mappers/user.mapper.js";

import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/parseId.js';

import * as UserService from '../services/user.service.js';

export function getMe(req : Request , res : Response){
    if(!req.user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ไม่พบผู้ใช้นี้ในระบบ");
    }

    const data = toMeDto(req.user);
    res.status(200).json(data);
}

export async function getUserById(req : Request , res : Response){
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.getUserById(userId));
};

export async function getUserStats(req : Request , res : Response){
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.getUserStats(userId));
}