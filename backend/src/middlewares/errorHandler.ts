// รับ error จากทั้งระบบมาแปลงเป็น json
import { AppError } from '../utils/AppError.js';
import type {Request , Response , NextFunction} from 'express';

/**
 * 🆕 29 ต.ค. 2569 (FE round 7 ขอ — "ทุก error ต้องมี `code` คงที่ FE แปลจาก code")
 *
 * error ที่ `express.json()` โยนเองก่อนถึง route ไม่ใช่ AppError ⇒ เดิมตกไปเป็น 500 INTERNAL_ERROR
 *   ส่ง JSON เสีย / body ใหญ่เกิน 100kb = **ความผิดของคนเรียก ไม่ใช่ของ server**
 *   ⇒ ได้ 500 ทำให้ FE ขึ้น "ระบบผิดพลาด" ผิดเรื่อง และ log ของ server รกด้วย stack ที่ไม่ใช่บั๊ก
 * ★ จับเฉพาะ error ของ body-parser — แยกด้วย `type` ที่ไลบรารีตั้ง (เช่น 'entity.parse.failed')
 *   error ทั่วไปไม่มี `type` แบบนี้ จึงไม่โดนจับผิดตัว
 */
const BODY_PARSER_ERRORS: Record<string, { status : number , code : string , message : string }> = {
    'entity.parse.failed' : { status : 400 , code : 'INVALID_JSON' , message : 'ข้อมูลที่ส่งมาไม่ใช่ JSON ที่ถูกต้อง' },
    'entity.too.large'    : { status : 413 , code : 'PAYLOAD_TOO_LARGE' , message : 'ข้อมูลที่ส่งมามีขนาดใหญ่เกินกำหนด' },
};

/** body-parser แนบ `type` + `status` (4xx) + `expose: true` ให้ทุก error ที่เป็นความผิดของคนเรียก */
function bodyParserError(err : Error){
    const { type , status , expose , limit } = err as { type?: unknown , status?: unknown , expose?: unknown , limit?: unknown };
    if (typeof type !== 'string') return null;
    const known = BODY_PARSER_ERRORS[type];
    if (known) return { ...known , extra : typeof limit === 'number' ? { limitBytes : limit } : {} };
    // ชนิดอื่นของ body-parser ที่ไม่ค่อยเจอ (charset/encoding ไม่รองรับ · ส่งไม่ครบ ฯลฯ) — ยังเป็นความผิดของคนเรียก
    if (expose === true && typeof status === 'number' && status >= 400 && status < 500) {
        return { status , code : 'INVALID_REQUEST_BODY' , message : 'อ่านข้อมูลที่ส่งมาไม่ได้' , extra : {} };
    }
    return null;
}

export function errorHandler(err : Error , req : Request , res : Response , next : NextFunction){
    if (err instanceof AppError){
        return res.status(err.status).json({error : {code : err.code ,message : err.message , ...err.extra }});
    }
    const bodyError = bodyParserError(err);
    if (bodyError){
        return res.status(bodyError.status).json({ error : { code : bodyError.code , message : bodyError.message , ...bodyError.extra } });
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
