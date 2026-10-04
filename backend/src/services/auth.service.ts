import { randomBytes , randomInt } from 'crypto';
import * as userRepo from '../repositories/user.repo.js';
import * as passwordResetRepo from '../repositories/passwordReset.repo.js';
import * as emailVerifyRepo from '../repositories/emailVerification.repo.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { AppError } from '../utils/AppError.js';
import type { RegisterInput } from '../schemas/auth.schema.js';
import { authConfig } from '../config/auth.js';
import { isCurrentlySuspended , suspendedError } from '../utils/suspension.js';
import { sendPasswordResetEmail , sendEmailVerificationOtp } from './mail.service.js';

import { findFacultyById } from '../repositories/faculty.repo.js';
import { findDepartmentInFaculty } from '../repositories/department.repo.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;   // 1 ชม. — ตรงกับที่เขียนในเมล (TASK-password-recovery §4)
const RESET_RATE_LIMIT_PER_HOUR = 3;         // GUIDE/06:503

// ═══ OD-53 · ยืนยันอีเมลด้วย OTP 6 หลัก ═══
const OTP_TTL_MINUTES = 10;                  // สั้นกว่า reset token (1 ชม.) เพราะของมีแค่ 6 หลัก เดาได้
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;                  // กรอกผิดครบ 5 = ใบนั้นตาย ขอใหม่เท่านั้น
const OTP_RATE_LIMIT_PER_HOUR = 3;           // ตัวเลขเดียวกับ reset — ไม่มีเหตุให้คนจำสองตัวเลข

/**
 * ★ randomInt ไม่ใช่ Math.random — ต้องเป็น CSPRNG เพราะสิ่งนี้คุ้มกันการเข้าถึงบัญชี
 * ★ randomInt(0 , 1000000) ไม่ใช่ randomBytes % 1000000 — modulo ของ 2^n ด้วย 10^6 ไม่ลงตัว
 *   ทำให้เลขช่วงต้นๆ มีโอกาสออกมากกว่า (modulo bias) ⇒ เดาได้ง่ายกว่า 1 ในล้าน
 * ★ padStart — ต้องยอมรับเลขที่ขึ้นต้นด้วยศูนย์ (007431) ไม่งั้นพื้นที่เดาเหลือแค่ 9 แสน
 */
function generateOtp() : string {
  return String(randomInt(0 , 1_000_000)).padStart(6 , '0');
}

/**
 * ออก OTP ใบใหม่ + ส่งเมล · คืน true เมื่อเมลออกจริง
 *
 * ★ ไม่โยน error ต่อเมื่อส่งเมลพัง แต่ **คืนค่าว่าพัง** — ต่างจาก forgotPassword()
 *   ที่กลืนเงียบๆ เพราะที่นั่นการบอกว่าส่งไม่สำเร็จ = บอกว่าอีเมลนี้มีอยู่ในระบบ
 *   แต่ register บอกอยู่แล้วว่าอีเมลซ้ำ (EMAIL_ALREADY_REGISTERED) ⇒ ไม่มีความลับให้รักษาตรงนี้
 *   การเงียบข้อนี้จะกลายเป็น "รอเมลที่ไม่มาโดยไม่รู้ว่าไม่มา" ซึ่งแย่กว่าไม่ปิดอะไรเลย
 * ★ ห้ามคืนเลข OTP ออกทาง response — เลขอยู่ในเมลเท่านั้น (นั่นคือสิ่งที่มันพิสูจน์)
 */
async function issueEmailVerificationOtp(userId : number , email : string , fullName : string) : Promise<boolean>{
  const code = generateOtp();
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await emailVerifyRepo.invalidateAllForUser(userId);   // ไม่ควรมีหลายใบใช้ได้พร้อมกัน
  await emailVerifyRepo.create(userId , codeHash , expiresAt);

  try{
    await sendEmailVerificationOtp(email , fullName , code , OTP_TTL_MINUTES);
    return true;
  }catch(err){
    console.error('sendEmailVerificationOtp failed:' , err);
    return false;
  }
}


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

  // OD-53 — ส่ง OTP หลังสร้างบัญชีสำเร็จแล้ว · สมัครสำเร็จไม่ขึ้นกับผลการส่งเมล
  // ถ้าส่งเมลก่อนแล้วค่อยสร้าง user เวลาที่ SMTP ล่มจะกลายเป็น "สมัครไม่ได้เพราะเมลพัง"
  // ซึ่งขัดกับมติของ OD-53 ที่ว่าการยืนยันห้ามบล็อกการสมัคร
  const emailVerificationSent = await issueEmailVerificationOtp(newId , input.email , input.fullName);

  return {id : newId , fullName : input.fullName , email : input.email , emailVerificationSent}
}


// ★ ข้อความเดียวทุกเคสที่ผิด (ไม่มีอีเมล/เลขผิด/หมดอายุ/ใช้แล้ว/กรอกผิดครบโควตา)
// เหตุเดียวกับ INVALID_RESET_TOKEN — แยกข้อความ = บอกคนเดาว่าเดาใกล้แค่ไหน
// ข้อความบอกวิธีแก้ไว้เลย ("กดขอรหัสใหม่") ⇒ FE ไม่ต้องแยก error code เพื่อบอกผู้ใช้ว่าต้องทำอะไรต่อ
const INVALID_OTP = () => new AppError(400 , 'INVALID_OTP' ,
  'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ กรุณากดขอรหัสใหม่');

/**
 * AV01 · POST /auth/verify-email — รับ { email , code } ไม่ต้องล็อกอิน
 *
 * ★ ทำไมไม่ใช้ requireAuth: register ไม่คืน accessToken ⇒ คนที่เพิ่งสมัครเสร็จยังไม่มี token
 *   ถ้าบังคับให้ล็อกอินก่อน จะกลายเป็น "สมัคร → ล็อกอิน → ค่อยกรอกรหัส" ซึ่งช้ากว่าเดิมหนึ่งขั้น
 *   และอีเมลในก้อนก็ไม่ใช่ความลับอยู่แล้ว — register บอกตรงๆ ว่าอีเมลไหนถูกใช้สมัครแล้ว
 * ★ ยืนยันซ้ำคืน 200 เหมือนเดิม (idempotent) — กดสองครั้ง/รีเฟรชหน้าไม่ควรเห็น error
 */
export async function verifyEmail(email : string , code : string) : Promise<{ message : string , emailVerified : true }>{
  const SUCCESS = { message : 'ยืนยันอีเมลสำเร็จ' , emailVerified : true as const };

  const user = await userRepo.findByEmail(email);
  if(!user){
    throw INVALID_OTP();
  }
  if(user.email_verified === 1){
    return SUCCESS;     // ยืนยันไปแล้ว — ไม่ต้องมี OTP ที่ใช้ได้อยู่ก็ถือว่าสำเร็จ
  }

  // รู้ user_id จากอีเมลแล้ว ⇒ กวาดแค่ใบของคนนี้ (ต่างจาก resetPassword ที่ต้องกวาดทุกคน)
  // ใบที่กรอกผิดครบ OTP_MAX_ATTEMPTS จะไม่อยู่ในผลเลย (กรองที่ SQL)
  const candidates = await emailVerifyRepo.findActiveByUser(user.user_id , OTP_MAX_ATTEMPTS);

  for(const row of candidates){
    if(await verifyPassword(code , row.code_hash)){
      await emailVerifyRepo.markUsed(row.email_verification_otp_id);
      await userRepo.markEmailVerified(user.user_id);
      await emailVerifyRepo.invalidateAllForUser(user.user_id);   // ล้างใบที่เหลือทั้งหมด
      return SUCCESS;
    }
  }

  // กรอกผิด ⇒ นับขึ้นทุกใบที่เปิดอยู่ (ปกติมีใบเดียว) — ครบโควตาแล้วใบนั้นตาย
  // ★ ถ้าไม่นับ ด่านกันเดาหายไปทั้งหมด — 6 หลักยิงรัวไม่จำกัดคือเดาออกได้ในหลักล้านครั้ง
  for(const row of candidates){
    await emailVerifyRepo.bumpAttempt(row.email_verification_otp_id);
  }

  throw INVALID_OTP();
}

/**
 * AV02 · POST /auth/resend-verification — ขอรหัสใหม่
 *
 * **คืน 200 เหมือนกันหมดทุกเคส** ทั้งไม่มีอีเมล / ยืนยันไปแล้ว / ส่งสำเร็จ / เกินโควตา
 *
 * ★ แก้เมื่อ 4 ต.ค. — เดิมโยน 429 เมื่อเกินโควตา (ตรวจจริงได้ผล 200·200·429)
 *   เหตุผลเดิมคือ "register บอกอยู่แล้วว่าอีเมลซ้ำ จึงไม่มีความลับให้รักษา" ซึ่ง
 *   **ถูกครึ่งเดียว**: register บอกว่า "อีเมลนี้มีบัญชี" จริง (EMAIL_ALREADY_REGISTERED)
 *   แต่ 429 ที่นี่บอกเพิ่มอีกชั้นว่า **บัญชีนั้นยังไม่ยืนยันอีเมล** ซึ่ง register ไม่ได้บอก
 *   ⇒ ยิง 3 ครั้งแล้วดูว่าได้ 429 มั้ย = คัดกรองได้ว่าบัญชีไหน "มีจริงและยังไม่ยืนยัน"
 *      ซึ่งเป็นกลุ่มที่น่าสนใจเป็นพิเศษสำหรับคนที่จะไปลองยึดบัญชี
 *
 * ★ กลไกกัน rate limit **ไม่ได้ถูกถอด** — ยังไม่ออกใบใหม่และไม่ส่งเมลเหมือนเดิม
 *   ที่เอาออกคือการ "ประกาศ" ว่าถูกกันไว้ เท่านั้น
 *
 * 🔴 ราคาที่ต้องจ่าย: ผู้ใช้จริงที่เกินโควตาจะได้ 200 แล้วนั่งรอเมลที่ไม่มา
 *   ⇒ **FE ต้องชดเชยด้วยการหน่วงปุ่ม 60 วินาทีทุกครั้งที่กด + เขียนกติกา
 *      "ขอรหัสใหม่ได้ 3 ครั้งต่อชั่วโมง" ไว้ข้างปุ่ม** (มติ 4 ต.ค. · แจ้ง FE แล้ว)
 *   คนที่รู้กติกาล่วงหน้าไม่ต้องให้ response มาบอก ส่วนคนสอดรู้ก็ไม่ได้อะไรจากคำตอบ
 */
export async function resendEmailVerification(email : string) : Promise<{ message : string }>{
  const SUCCESS = { message : 'ถ้าอีเมลนี้ยังรอยืนยัน เราได้ส่งรหัสใหม่ไปให้แล้ว' };

  const user = await userRepo.findByEmail(email);
  if(!user || user.email_verified === 1){
    return SUCCESS;
  }

  // เกินโควตา → เงียบ ๆ ไม่ออกใบใหม่ ไม่ส่งเมล แต่คืน SUCCESS ก้อนเดิม
  // ★ ห้ามเปลี่ยนกลับไปโยน error — ดูเหตุผลในคอมเมนต์หัวฟังก์ชัน (มีเทสตรึงไว้)
  const issuedCount = await emailVerifyRepo.countIssuedWithinLastHour(user.user_id);
  if(issuedCount >= OTP_RATE_LIMIT_PER_HOUR){
    return SUCCESS;
  }

  await issueEmailVerificationOtp(user.user_id , user.email , user.full_name);
  return SUCCESS;
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

  /**
   * OD-54 (4 ต.ค.) — เกินโควตาแล้ว **คืน 200 เหมือนเดิม ไม่โยน 429**
   *
   * ★ เดิมโยน 429 ที่นี่ ซึ่งอยู่ **หลัง** การเช็คว่ามี user ⇒ ยิง 4 ครั้งติดกันแล้ว
   *   ได้ 429 = อีเมลนั้นมีจริงและไม่ถูกระงับ · ได้ 200 ทั้ง 4 = ไม่มีในระบบ
   *   เป็นช่องกวาดหาอีเมลที่คำสัญญา "ตอบ 200 เหมือนกันเป๊ะทุกกรณี" ตั้งใจปิดพอดี
   *
   * ★ การกันยังอยู่ครบ — ยังไม่ออก token และยังไม่ส่งเมล เพียงแต่ไม่ประกาศออกไป
   *   ⇒ เพดาน 3 ฉบับ/ชม. ที่กันการถล่มเมลใส่เหยื่อยังทำงานเหมือนเดิมทุกอย่าง
   *
   * ★ ไม่ทำให้ผู้ใช้จริงสับสน — คนที่ติดเพดานคือคนที่ "ได้รับเมลไป 3 ฉบับแล้วในชั่วโมงนี้"
   *   ข้อความ "ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ไปให้แล้ว" จึงยังจริงสำหรับเขา
   *   สิ่งที่เขาต้องทำคือไปเปิดกล่องเมล ไม่ใช่รู้ว่าถูกจำกัดจำนวนครั้ง
   *
   * ★ ต่างจาก AV02 (resend-verification) ที่ยังโยน 429 อยู่ — ที่นั่น register
   *   บอกอยู่แล้วว่าอีเมลไหนถูกใช้สมัคร ⇒ ไม่มีคำสัญญาเรื่องปิดการมีอยู่ให้รักษา
   *   ดู OD-54 สำหรับความต่างของสองเส้นนี้
   */
  const issuedCount = await passwordResetRepo.countIssuedWithinLastHour(user.user_id);
  if(issuedCount >= RESET_RATE_LIMIT_PER_HOUR){
    return FORGOT_PASSWORD_SUCCESS;
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