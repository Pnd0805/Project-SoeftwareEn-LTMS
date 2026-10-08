import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * code เฉพาะต่อ field ตาม Part 4 (เช่น reason → CHECKIN_REJECT_REASON_REQUIRED)
 * ไม่ส่ง = ตอบ VALIDATION_FAILED เหมือนเดิม — route อื่นไม่ต้องแก้อะไร
 */
export type FieldErrorCodes = Record<string, { code: string; message: string }>;

export function validate(schema: ZodType, fieldCodes?: FieldErrorCodes){   //เทียบ: ZodType = "อะไรก็ได้ที่เป็น schema ของ Zod" คล้ายกับที่ Error เป็นแม่ของ AppError ของคุณ
  return (req:Request , res:Response , next:NextFunction)=>{
    const result = schema.safeParse(req.body);

    if(!result.success){
      const fields: Record<string , string> = {};

      for (const issue of result.error.issues){
        fields[String(issue.path[0])] = issue.message
      }

      // ถ้า field ที่ผิดมี code เฉพาะ → ใช้ code นั้น (ยังส่ง fields ครบเหมือนเดิม)
      const specific = fieldCodes && Object.keys(fields).map(f => fieldCodes[f]).find(c => c !== undefined);
      if(specific){
        return next(new AppError(400 , specific.code , specific.message , { fields }))
      }
      return next(new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" , { fields } ))
    }

    req.body = result.data;
    next();

  }
};