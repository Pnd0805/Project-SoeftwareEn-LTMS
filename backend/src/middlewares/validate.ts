import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError.js';

export function validate(schema: ZodType){   //เทียบ: ZodType = "อะไรก็ได้ที่เป็น schema ของ Zod" คล้ายกับที่ Error เป็นแม่ของ AppError ของคุณ
  return (req:Request , res:Response , next:NextFunction)=>{
    const result = schema.safeParse(req.body);

    if(!result.success){
      const fields: Record<string , string> = {}; 

      for (const issue of result.error.issues){
        fields[String(issue.path[0])] = issue.message
      }
      return next(new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" , { fields } ))
    }

    req.body = result.data;
    next();

  }
};