import type { Request , Response , NextFunction} from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/token.js';
import { findById } from '../repositories/user.repo.js';

export async function requireAuth(req : Request , res : Response , next : NextFunction){
    const token = req.headers.authorization;  //retrive token coming with http request
    if(!token){   //เช็คว่ามี token attach with request
        return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
    }

    const bearer = token.split(" ")[0]
    if (bearer !== "Bearer"){   //check if token is bearer type
        return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
    }

    const accessToken = token.split(" ")[1];
    if(!accessToken){           //get only token exclude bearer
        return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
    }
    
    const { sub } = verifyToken(accessToken);  //ดึง sub destructuring for array pull "key" not index

    // *** ถ้า user ถูกลบทำไง ***//
    const user = await findById(Number(sub));  //DB query
    if(!user){  
        return next(new AppError(401 , "USER_NOT_FOUND" , "ไม่พบผู้ใช้นี้ในระบบ"));
    }

    if(user.is_suspended === 1){   //Account ถูกระงับ
        return next(new AppError(403 , 'ACCOUNT_SUSPENDED' , 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'));
    }

    req.user = user;
    next();
};


