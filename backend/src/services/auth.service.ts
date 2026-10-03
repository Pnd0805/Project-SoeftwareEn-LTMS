import { randomBytes } from 'crypto';
import * as userRepo from '../repositories/user.repo.js';
import * as passwordResetRepo from '../repositories/passwordReset.repo.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { AppError } from '../utils/AppError.js';
import type { RegisterInput } from '../schemas/auth.schema.js';
import { authConfig } from '../config/auth.js';
import { isCurrentlySuspended , suspendedError } from '../utils/suspension.js';
import { sendPasswordResetEmail } from './mail.service.js';

import { findFacultyById } from '../repositories/faculty.repo.js';
import { findDepartmentInFaculty } from '../repositories/department.repo.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;   // 1 ชม. — ตรงกับที่เขียนในเมล (TASK-password-recovery §4)
const RESET_RATE_LIMIT_PER_HOUR = 3;         // GUIDE/06:503


export async function register(input: RegisterInput) {
  const existing = await userRepo.findByEmail(input.email);
  if (existing) {
    throw new AppError(400, 'EMAIL_ALREADY_REGISTERED',
      'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ',
      { fields: { email: 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ' } });
  }

  const fac = await findFacultyById(input.facultyId);
  if(!fac){
    const fields = { 'facultyId' : "ไม่พบคณะที่เลือก"};
    throw new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" ,  { fields });
  }

  const depCheck = await findDepartmentInFaculty(input.facultyId , input.departmentId);
  if(!depCheck){
      const fields = { 'departmentId' : "ภาควิชาที่เลือกไม่อยู่ในคณะนี้"};
      throw new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" ,  { fields });
  }

  const passwordHash = await hashPassword(input.password)

  const newId = await userRepo.create({fullName : input.fullName , email : input.email , passwordHash : passwordHash ,
    gender : input.gender , birthDate : input.birthDate , facultyId : input.facultyId , departmentId : input.departmentId , year : input.year});

  return {id : newId , fullName : input.fullName , email : input.email}
}


export async function login(email: string, password: string) {
  const user = await userRepo.findByEmail(email);
  if(!user){
    throw new AppError(401 , 'INVALID_CREDENTIALS' , "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
  }

  const ok = await verifyPassword(password , user.password_hash);
  if(!ok){
    throw new AppError(401 , 'INVALID_CREDENTIALS' , "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
  }

  if(isCurrentlySuspended(user)){
    throw suspendedError(user)
  }

  const accessToken = signToken(user.user_id)
  return { accessToken : accessToken, expiresIn: authConfig.expireIn, tokenType: "Bearer" as const ,
           user: { id: user.user_id , fullName : user.full_name , userType: user.user_type }}
}


// ★ ต้องตอบเหมือนกันเป๊ะทุกกรณี (มีอีเมล/ไม่มี/ถูกระงับ) — ห้าม 404 ไม่งั้นกลายเป็นเครื่องมือกวาดหาอีเมลในระบบ
const FORGOT_PASSWORD_SUCCESS = { message : 'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว' };

export async function forgotPassword(email : string) : Promise<{ message : string }>{
  const user = await userRepo.findByEmail(email);
  if(!user || isCurrentlySuspended(user)){
    return FORGOT_PASSWORD_SUCCESS;
  }

  const issuedCount = await passwordResetRepo.countIssuedWithinLastHour(user.user_id);
  if(issuedCount >= RESET_RATE_LIMIT_PER_HOUR){
    throw new AppError(429 , 'RATE_LIMITED' , 'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
  }

  const rawToken = randomBytes(32).toString('hex');   // ★ ห้าม randomUUID — เดาง่ายกว่า
  const tokenHash = await hashPassword(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await passwordResetRepo.invalidateAllForUser(user.user_id);   // ไม่ควรมีหลายใบใช้ได้พร้อมกัน
  await passwordResetRepo.create(user.user_id , tokenHash , expiresAt);

  // ★ ห้ามโยน error ต่อ — SMTP ล่มต้องยังตอบ 200 เหมือนเดิม ไม่งั้นเวลาตอบที่ต่างกันก็รั่วว่าอีเมลมีจริง
  try{
    await sendPasswordResetEmail(user.email , user.full_name , rawToken);
  }catch(err){
    console.error('sendPasswordResetEmail failed:' , err);
  }

  return FORGOT_PASSWORD_SUCCESS;
}

// ★ ข้อความเดียวกันทั้ง 4 เคส (ไม่มี/ผิด/ใช้แล้ว/หมดอายุ) — แยกข้อความ = บอกคนเดา token ว่าเดาใกล้แค่ไหน
const INVALID_RESET_TOKEN = () => new AppError(400 , 'INVALID_RESET_TOKEN' , 'ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่');

export async function resetPassword(token : string , newPassword : string) : Promise<{ message : string }>{
  // ไม่มี user_id มาก่อน (รับแค่ token ดิบ) — ต้องกวาดทุกใบที่ยังใช้ได้มา verifyPassword ทีละแถว
  const candidates = await passwordResetRepo.findAllActive();

  let matchedUserId : number | null = null;
  for(const row of candidates){
    if(await verifyPassword(token , row.token_hash)){
      matchedUserId = row.user_id;
      break;
    }
  }

  if(matchedUserId === null){
    throw INVALID_RESET_TOKEN();
  }

  const user = await userRepo.findById(matchedUserId);
  if(!user || isCurrentlySuspended(user)){
    throw INVALID_RESET_TOKEN();
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepo.updatePassword(user.user_id , passwordHash);
  await passwordResetRepo.invalidateAllForUser(user.user_id);   // ล้างใบที่เหลือ (รวมใบที่ใช้ไปแล้ว) ทั้งหมด

  return { message : 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' };
}