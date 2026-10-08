// รับ error จากทั้งระบบมาแปลงเป็น json
import { AppError } from '../utils/AppError.js';
import type {Request , Response , NextFunction} from 'express';

export function errorHandler(err : Error , req : Request , res : Response , next : NextFunction){
    if (err instanceof AppError){
        return res.status(err.status).json({error : {code : err.code ,message : err.message , ...err.extra }});
    }
    /**
     * 🆕 BE-10 · BE-38 (7 ต.ค. 2569 · มติ ⑦ ค) — แปลงการชน UNIQUE ของ "คำขอที่ยังค้าง" เป็น 409
     *
     * ด่านกันคำขอซ้ำมีสองชั้น: service (SELECT แล้ว INSERT) และ UNIQUE ที่ฐาน (migration 048)
     * ชั้นที่สองจะทำงานเฉพาะกรณีที่สองคำขอเขียนพร้อมกันจนชั้นแรกไม่ทัน (กดสองแท็บ)
     * ⇒ ถ้าไม่แปลงที่นี่ ผู้ใช้ในเคสนั้นจะได้ 500 INTERNAL_ERROR ทั้งที่ระบบทำงานถูกต้อง
     *
     * ★ จับแคบ: เฉพาะ index ที่ลงท้าย `_pending` ซึ่งเป็นชุดที่ migration 048 สร้าง
     *   การชน UNIQUE อื่น (อีเมลซ้ำ · ชื่อทีมซ้ำ ฯลฯ) มีด่านและข้อความของตัวเองอยู่แล้ว
     *   ถ้าจับกว้างจะกลบข้อความที่ถูกต้องของที่อื่นเป็นข้อความกลาง ๆ ของที่นี่
     */
    const code = (err as { code?: string }).code;
    const sqlMessage = (err as { sqlMessage?: string }).sqlMessage ?? '';
    if (code === 'ER_DUP_ENTRY' && /_pending'?$|_pending'/.test(sqlMessage)) {
        return res.status(409).json({ error : {
            code : 'DUPLICATE_PENDING_REQUEST',
            message : 'มีคำขอเรื่องนี้ค้างอยู่แล้ว — กรุณารีเฟรชหน้าจอแล้วตรวจสอบก่อนยื่นใหม่' } });
    }

    console.error(err);
    res.status(500).json({error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' }})
}
