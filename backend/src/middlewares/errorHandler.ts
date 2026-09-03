// รับ error จากทั้งระบบมาแปลงเป็น json
import { AppError } from '../utils/AppError.js';
import type {Request , Response , NextFunction} from 'express';

export function errorHandler(err : Error , req : Request , res : Response , next : NextFunction){
    if (err instanceof AppError){
        return res.status(err.status).json({error : {code : err.code ,message : err.message , ...err.extra }});
    }
    console.error(err);
    res.status(500).json({error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' }})
}
