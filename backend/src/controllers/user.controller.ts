import type {Request , Response} from 'express';
import { toMeDto } from "../mappers/user.mapper.js";

import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/parseId.js';

import * as UserService from '../services/user.service.js';

export async function getMe(req : Request , res : Response){
    if(!req.user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ไม่พบผู้ใช้นี้ในระบบ");
    }

    const data = toMeDto(req.user);
    res.status(200).json(data);
}

export async function getUserById(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.getUserById(userId, req.user?.user_id));
};

export async function getUserStats(req : Request , res : Response){
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.getUserStats(userId));
}


export async function followUser(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.followUser(req.user!.user_id, userId));
}

export async function unfollowUser(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.unfollowUser(req.user!.user_id, userId));
}

export async function getFollowers(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.getFollowers(userId));
}

export async function getFollowing(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.getFollowing(userId));
}

export async function getMyFollowing(req: Request, res: Response) {
    res.status(200).json(await UserService.getFollowing(req.user!.user_id));
}

export async function getCareer(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await UserService.getCareer(userId));
}

export async function searchUser(req : Request , res : Response){
    const q = req.query['q'];
    if( typeof(q) !== 'string'){
        throw new AppError(400 , "QUERY_TOO_SHORT" , "กรุณาพิมพ์อย่างน้อย 3 ตัวอักษร");
    }
    res.status(200).json(await UserService.searchUsers(q));
}

export async function patchMe(req : Request , res : Response){
    if(!req.user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ไม่พบผู้ใช้นี้ในระบบ");
    }
    res.status(200).json(await UserService.updateMe( req.user.user_id , req.body));
}

export async function getMyInvitation(req : Request , res : Response){
    res.status(200).json(await UserService.getMyInvitation(req.user!.user_id));
}