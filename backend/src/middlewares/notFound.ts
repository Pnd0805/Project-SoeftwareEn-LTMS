import { AppError } from "../utils/AppError.js";
import type { Request , Response , NextFunction} from 'express';

export function notFound(req: Request, res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'ไม่พบข้อมูลที่ต้องการ'));
}