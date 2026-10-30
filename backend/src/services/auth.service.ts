import { createHash , randomBytes , randomInt } from 'crypto';
import * as userRepo from '../repositories/user.repo.js';
import * as passwordResetRepo from '../repositories/passwordReset.repo.js';
import * as emailVerifyRepo from '../repositories/emailVerification.repo.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { AppError } from '../utils/AppError.js';
import type { RegisterInput } from '../schemas/auth.schema.js';
import { authConfig } from '../config/auth.js';
import { env } from '../config/env.js';
import { isCurrentlySuspended , suspendedError } from '../utils/suspension.js';
import { isExternalEmail } from '../utils/kuEmail.js';
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
  /**
   * OD-53 (29 ต.ค. 2569) — อีเมลซ้ำที่ **ยังไม่ยืนยัน** ไม่ถือว่าซ้ำ แต่ให้เขียนทับใบเดิม
   *
   * ของเดิมปฏิเสธทุกกรณี ⇒ คนที่สมัครแล้วไม่กรอก OTP แล้วกลับมาสมัครใหม่ จะเจอ
   * "อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบ" ทั้งที่ **เข้าสู่ระบบไม่ได้** และอีเมลเป็นของเขาเอง
   * ⇒ ทางตัน ต้องรอให้งานกวาดลบแถวทิ้งก่อน (ตั้งต้น 24 ชม.)
   *
   * 🔴 ปฏิเสธเหมือนเดิมเมื่อ `email_verified = 1` — ไม่งั้นใครก็ยึดบัญชีคนอื่นได้
   *   ด้วยการสมัครด้วยอีเมลนั้นแล้วตั้งรหัสใหม่ (ดูด่านซ้ำใน userRepo.overwriteUnverified)
   */
  const existing = await userRepo.findByEmail(input.email);
  /**
   * 🔴 30 ต.ค. 2569 (bug hunt ข้อ 2) — ทับใบเดิมได้ **เฉพาะตอนด่าน REQUIRE_EMAIL_VERIFIED เปิด**
   *   ด่านปิด = คนที่ไม่ยืนยันล็อกอินและใช้งานได้เต็มที่ (มีทีม ใบสมัคร แต้ม)
   *   ⇒ ถ้ายอมให้ทับ ใครก็สมัครด้วยอีเมลของเขา ตั้งรหัสใหม่ แล้ว **เข้าบัญชีเขาได้ทันที**
   *   ด่านปิดจึงตอบเหมือนอีเมลซ้ำ — ไม่เป็นทางตัน เพราะเจ้าของล็อกอินด้วยรหัสเดิมได้อยู่แล้ว
   *   (ลืมรหัสก็ใช้ลืมรหัสผ่านได้ตามปกติ)
   * ★ ด่านเปิด = ทับได้ตามเดิม · คนร้ายทับแล้วก็ล็อกอินไม่ได้ เพราะ OTP ไปที่อีเมลของเจ้าของ
   * ★ หลักเดียวกับงานกวาดบัญชี (purgeUnverifiedAccounts): พฤติกรรมของ "บัญชีไม่ยืนยัน" ต้องดูสวิตช์เสมอ
   */
  if (existing && (existing.email_verified === 1 || !env.REQUIRE_EMAIL_VERIFIED)) {
    throw new AppError(400, 'EMAIL_ALREADY_REGISTERED',
      'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ',
      { fields: { email: 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ' } });
  }

  // มติ 6 ต.ค. 2569 — user_type คิดจากโดเมนอีเมล (@ku.th = student) ไม่ hardcode 'student' อีกต่อไป
  // กฎโดเมนอยู่ที่ utils/kuEmail.ts ที่เดียว (ใช้ร่วมกับ referee.service.ts) ห้ามเขียนซ้ำที่นี่
  const external = isExternalEmail(input.email);
  const userType = external ? 'external' as const : 'student' as const;

  /**
   * 🔴 มติ 8 ต.ค. 2569 — คนนอกสมัครได้โดยไม่มีคณะ/ภาควิชา/ชั้นปี (เก็บเป็น NULL ทั้งสามช่อง)
   *
   * ของเดิมบังคับครบทุกคน ⇒ **คนนอกสมัครไม่ได้เลย** เพราะไม่มีคณะให้เลือก
   * ★ ถึงคนนอกจะส่งค่าสามช่องนี้มา ก็ **ไม่เก็บ** — ปล่อยผ่านแล้วนับเป็น NULL ตามมติ
   *   (ไม่ตอบ error เพราะ FE อาจค้างค่าจากหน้าก่อนไว้ แล้วคนนอกจะสมัครไม่ได้เพราะเรื่องที่ไม่สำคัญ)
   * ★ ด่านตรวจว่าคณะ/ภาควิชามีจริงจึงทำ **เฉพาะคนใน** — ของคนนอกไม่มีอะไรให้ตรวจ
   */
  const facultyId = external ? null : input.facultyId!;
  const departmentId = external ? null : input.departmentId!;
  const year = external ? null : input.year!;

  if(!external){
    //  ปลอดภัยเพราะ superRefine ของ registerSchema บังคับครบสามช่องแล้วเมื่ออีเมลเป็น @ku.th
    const fac = await findFacultyById(input.facultyId!);
    if(!fac){
      const fields = { 'facultyId' : "ไม่พบคณะที่เลือก"};
      throw new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" ,  { fields });
    }

    const depCheck = await findDepartmentInFaculty(input.facultyId! , input.departmentId!);
    if(!depCheck){
        const fields = { 'departmentId' : "ภาควิชาที่เลือกไม่อยู่ในคณะนี้"};
        throw new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" ,  { fields });
    }
  }

  const passwordHash = await hashPassword(input.password)

  const fields = {fullName : input.fullName , email : input.email , passwordHash : passwordHash ,
    gender : input.gender , birthDate : input.birthDate , userType , facultyId , departmentId , year};

  /**
   * ★ ทับใบเดิมถ้ามี (ยังไม่ยืนยัน) — ทับ **ทุกช่อง** เพราะเขาอาจกรอกไม่เหมือนรอบแรก
   *   โดยเฉพาะรหัสผ่าน ถ้าไม่ทับเขาจะล็อกอินด้วยรหัสที่เพิ่งตั้งไม่ได้และหาสาเหตุไม่เจอ
   * 🔴 ถ้าทับไม่สำเร็จ (affectedRows = 0) แปลว่ามีคนยืนยันแถวนั้นไปแล้วระหว่างนี้
   *   ⇒ ปฏิเสธเหมือนอีเมลซ้ำ ไม่ใช่สร้างแถวใหม่ (จะชน UNIQUE อยู่ดี)
   */
  let newId : number;
  if(existing){
    if(!await userRepo.overwriteUnverified(existing.user_id , fields)){
      throw new AppError(400, 'EMAIL_ALREADY_REGISTERED',
        'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ',
        { fields: { email: 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ' } });
    }
    newId = existing.user_id;
  }else{
    newId = await userRepo.create(fields);
  }

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

  // ★ จองสิทธิ์เดาก่อนเทียบทุกครั้ง (claimAttempt) — ครบโควตาแล้วใบนั้นตาย
  //   ถ้าไม่นับ ด่านกันเดาหายไปทั้งหมด — 6 หลักยิงรัวไม่จำกัดคือเดาออกได้ในหลักล้านครั้ง
  // 🔴 bug hunt 30 ต.ค. ข้อ 8 — เดิมนับ "หลัง" เทียบ ⇒ ยิงพร้อมกันหลายคำขอผ่านด่าน 5 ครั้งได้ทุกคำขอ
  for(const row of candidates){
    if(!await emailVerifyRepo.claimAttempt(row.email_verification_otp_id , OTP_MAX_ATTEMPTS)) continue;
    if(await verifyPassword(code , row.code_hash)){
      await emailVerifyRepo.markUsed(row.email_verification_otp_id);
      await userRepo.markEmailVerified(user.user_id);
      await emailVerifyRepo.invalidateAllForUser(user.user_id);   // ล้างใบที่เหลือทั้งหมด
      return SUCCESS;
    }
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


/**
 * bug hunt 30 ต.ค. 2569 (ข้อเล็ก) — hash หลอกไว้เทียบเมื่อไม่พบอีเมล ให้เวลาตอบเท่ากับกรณีรหัสผิด
 *   เดิมอีเมลที่ไม่มีในระบบตอบทันที (ไม่ได้รัน bcrypt) ⇒ จับเวลาแล้วรู้ว่าอีเมลไหนสมัครไว้
 * ★ cost 10 เท่ากับ SALT_ROUND ของรหัสจริง (utils/password.ts) — ต่างกัน = เวลาต่างกันอีก
 * ★ ไม่ใช่รหัสของใคร ไม่มีใคร "ล็อกอินด้วยรหัสนี้" ได้ เพราะไม่มีแถวผู้ใช้ให้เข้า
 */
const TIMING_DUMMY_HASH = '$2b$10$Z6xpPqNtsSD0ZHGPCUbk6e2zQV1.aNs.Rwj7SL/q0cydqhoe1x7We';

export async function login(email: string, password: string) {
  const user = await userRepo.findByEmail(email);
  if(!user){
    await verifyPassword(password , TIMING_DUMMY_HASH);
    throw new AppError(401 , 'INVALID_CREDENTIALS' , "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
  }

  const ok = await verifyPassword(password , user.password_hash);
  if(!ok){
    throw new AppError(401 , 'INVALID_CREDENTIALS' , "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
  }

  if(isCurrentlySuspended(user)){
    throw suspendedError(user)
  }

  /**
   * OD-53 (29 ต.ค. 2569) — ด่านบังคับยืนยันอีเมล · เปิด/ปิดด้วย `REQUIRE_EMAIL_VERIFIED`
   *
   * ★ อยู่ **หลัง** ด่านรหัสผ่านโดยเจตนา — ถ้าเช็คก่อน คนที่กรอกรหัสผิดจะได้ข้อความ
   *   "ยังไม่ยืนยันอีเมล" ซึ่งยืนยันให้คนนอกรู้ว่าอีเมลนี้มีบัญชีอยู่จริง
   * ★ และอยู่ **หลัง** ด่านระงับ เพราะการถูกระงับเป็นเรื่องที่ต้องรู้ก่อน (ติดต่อผู้ดูแล)
   *   ส่วนการยืนยันอีเมลเป็นเรื่องที่เจ้าตัวแก้เองได้
   *
   * 🔴 ตอบ 403 ไม่ใช่ 401 — 401 ทำให้ FE เข้าใจว่า "รหัสผิด" แล้วให้กรอกใหม่วนไปเรื่อย ๆ
   *   โดยไม่มีทางหลุด · `email` ส่งกลับไปเพื่อให้ FE ยิง resend-verification ต่อได้ทันที
   */
  if(env.REQUIRE_EMAIL_VERIFIED && user.email_verified !== 1){
    throw new AppError(403 , 'EMAIL_NOT_VERIFIED' ,
      'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ — กดขอรหัสยืนยันใหม่ได้จากหน้ายืนยันอีเมล' ,
      { email : user.email });
  }

  const accessToken = signToken(user.user_id , user.token_version)
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
   * ★ AV02 (resend-verification) ก็คืน 200 เงียบเหมือนกันแล้วเมื่อ 4 ต.ค. — คำตอบเหมือนกัน
   *   แต่ **คุ้มกันคนละชิ้น**:
   *     ที่นี่ (forgot-password)  ปิดว่า "อีเมลนี้มีบัญชีหรือไม่"
   *     AV02                 ปิดว่า "บัญชีนั้นยังไม่ยืนยันอีเมลหรือไม่" — ซึ่ง register ไม่ได้บอก
   *   ⇒ ห้ามยุบเป็นกฎข้อเดียวว่า "เกินโควตาแล้วคืน 200" — วันที่เส้นหนึ่งเปลี่ยน
   *     อีกเส้นไม่ได้เปลี่ยนตามอัตโนมัติ
   *   ดู OD-54 สำหรับความต่างของสองเส้นนี้
   */
  const issuedCount = await passwordResetRepo.countIssuedWithinLastHour(user.user_id);
  if(issuedCount >= RESET_RATE_LIMIT_PER_HOUR){
    return FORGOT_PASSWORD_SUCCESS;
  }

  const rawToken = randomBytes(32).toString('hex');   // ★ ห้าม randomUUID — เดาง่ายกว่า
  const tokenHash = hashResetToken(rawToken);
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

/**
 * 🔴 bug hunt 30 ต.ค. 2569 ข้อ 7 — hash ของลิงก์รีเซ็ตเป็น SHA-256 ไม่ใช่ bcrypt
 *   token สุ่ม 32 ไบต์ เดาไม่ได้อยู่แล้ว ⇒ ไม่ต้องใช้ bcrypt (ที่ทำให้ช้าโดยเจตนาเพื่อรหัสผ่านที่คนตั้ง)
 *   และ hash เดิมทุกครั้ง ⇒ ค้นในฐานด้วย WHERE ได้ตรง ๆ ไม่ต้องกวาดทุกใบมาเทียบทีละใบ
 * ★ ลิงก์ที่ออกก่อนเปลี่ยน (hash แบบ bcrypt) ใช้ไม่ได้แล้ว — อายุ 1 ชม. อยู่แล้ว ขอใหม่ได้
 */
function hashResetToken(rawToken : string) : string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function resetPassword(token : string , newPassword : string) : Promise<{ message : string }>{
  const row = await passwordResetRepo.findActiveByHash(hashResetToken(token));
  if(!row){
    throw INVALID_RESET_TOKEN();
  }

  const user = await userRepo.findById(row.user_id);
  if(!user || isCurrentlySuspended(user)){
    throw INVALID_RESET_TOKEN();
  }

  // จองใบนี้ก่อนเปลี่ยนรหัส — ยิงพร้อมกันสองครั้งด้วยลิงก์เดียว คนที่สองได้ข้อความเดียวกับลิงก์ใช้แล้ว
  if(await passwordResetRepo.markUsed(row.password_reset_token_id) === 0){
    throw INVALID_RESET_TOKEN();
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepo.updatePassword(user.user_id , passwordHash);
  await passwordResetRepo.invalidateAllForUser(user.user_id);   // ล้างใบที่เหลือ (รวมใบที่ใช้ไปแล้ว) ทั้งหมด

  return { message : 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' };
}

/**
 * OD-53 (29 ต.ค. 2569) — งานเบื้องหลัง: ลบบัญชีที่สมัครแล้วไม่ยืนยันอีเมลเกินกำหนด
 *
 * ★ เหตุผลคือ **ข้อมูลส่วนบุคคล** ไม่ใช่พื้นที่ฐานข้อมูล — แถวหนึ่งเก็บชื่อ อีเมล วันเกิด เพศ
 *   คณะ ภาควิชา ชั้นปี ของคนที่สมัครไม่สำเร็จและไม่เคยพิสูจน์ว่าอีเมลเป็นของตน
 *   (หลักการเดียวกับ OD-70 ที่ลบภาพยืนยันตัวตนกรรมการเมื่อหมดหน้าที่)
 *
 * 🔴 ผลข้างเคียงที่ต้องยอมรับ: คนที่กลับมาหลังแถวถูกลบแล้วกด "ขอรหัสใหม่" จะได้ 200
 *   ตามปกติ (เส้นนั้นตอบเหมือนกันทุกกรณีกันการกวาดหาอีเมล) **แต่ไม่มีเมลมา**
 *   ⇒ แก้ที่ฝั่ง FE ด้วยข้อความ "ไม่ได้รับรหัสภายใน 10 นาที? สมัครใหม่ด้วยอีเมลเดิมได้เลย"
 *     ซึ่งใช้ได้จริงเพราะอีเมลว่างแล้ว · **ไม่ใช่ทางตันทางเทคนิค แต่เป็นเรื่องบอกผู้ใช้ให้รู้**
 */
/** QA 30 ต.ค. (C3) — บัตรทุกใบของผู้ใช้คนนี้ใช้ไม่ได้ทันที (ทุกเครื่อง) · เหตุผลอยู่ที่ auth.controller logout */
export async function logout(userId : number) : Promise<void>{
  await userRepo.bumpTokenVersion(userId);
}

export async function purgeUnverifiedAccounts(){
  /**
   * 🔴 29 ต.ค. 2569 (UserNaito เคาะ) — ลบเฉพาะตอนเปิดด่าน REQUIRE_EMAIL_VERIFIED
   *   ด่านปิด = คนที่ยังไม่ยืนยันล็อกอินและใช้งานได้ตามปกติ ⇒ เขาเป็นผู้ใช้จริง ไม่ใช่ "สมัครไม่สำเร็จ"
   *   เดิมงานนี้ลบไม่ดูสวิตช์ ⇒ บัญชีที่ใช้งานอยู่หายเงียบหลัง 24 ชม. หรือถ้ามีข้อมูลผูกอยู่ ทั้งรอบล้ม FK
   */
  if(!env.REQUIRE_EMAIL_VERIFIED) return 0;
  return userRepo.purgeUnverifiedOlderThan(env.UNVERIFIED_ACCOUNT_TTL_HOURS);
}
