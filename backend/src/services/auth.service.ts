import * as userRepo from '../repositories/user.repo.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { AppError } from '../utils/AppError.js';
import type { RegisterInput } from '../schemas/auth.schema.js';
import { authConfig } from '../config/auth.js';

import { findFacultyById } from '../repositories/faculty.repo.js';
import { findDepartmentInFaculty } from '../repositories/department.repo.js';


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

  if(user.is_suspended === 1){
    throw new AppError(403 , 'ACCOUNT_SUSPENDED' , 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
  }

  const accessToken = signToken(user.user_id)
  return { accessToken : accessToken, expiresIn: authConfig.expireIn, tokenType: "Bearer" as const ,
           user: { id: user.user_id , fullName : user.full_name , userType: user.user_type }}
}