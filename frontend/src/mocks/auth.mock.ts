/**
 * src/mocks/auth.mock.ts
 *
 * Mock login/register responses — ครอบคลุมทุก scenario ที่ LoginPage/RegisterForm ต้องรับมือ:
 *   - register สำเร็จ → email ที่ไม่ซ้ำ
 *   - register ล้มเหลว → email ซ้ำ (EMAIL_TAKEN) / validation failed / internal error
 *   - login สำเร็จ → token + user type (student/staff/student as organizer/etc)
 *   - login ล้มเหลว → invalid credentials (INVALID_CREDENTIALS) / user not found / locked / etc
 *
 * ⚠️ passwordForMock อยู่ใน user.mock.ts — auth.mock ใช้ read/write mockUsers ตรงนี้
 */
import type { LoginResponse, RegisterResponse, RegisterRequest, VerifyEmailRequest, VerifyEmailResponse, ResendVerificationResponse } from "../types/dto";
import { isKuEmail } from '../shared/kuEmail';
import { findStoreUserByEmail, isStoreUserSuspended } from "./storeUsers";
import { mockUsers, takeNextMockUserId } from "./user.mock";
import { mockDelay, mockReject } from "../api/client";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Mock login — ตรวจ email + passwordForMock จาก mockUsers
 * ถ้าถูก → return LoginResponse พร้อม accessToken
 * ถ้าผิด → mockReject 401 INVALID_CREDENTIALS
 */
export async function mockLogin(email: string, password: string): Promise<LoginResponse> {
  /* บัญชีที่เขียนมือ 5 ใบก่อน แล้วค่อยตกไปหาคนใน seed ทั้ง 97 คน
     สิทธิ์เกือบทั้งหมดผูกกับความสัมพันธ์ ไม่ใช่ role — ถ้าล็อกอินได้แค่ห้าคน
     ปุ่มส่วนใหญ่จะไม่มีใครมีสิทธิ์กด ดู mocks/storeUsers.ts */
  const user = mockUsers.find((u) => u.email === normalizeEmail(email))
    ?? findStoreUserByEmail(email);
  // GUIDE/04 §12: หาไม่เจอ กับ รหัสผิด ต้องตอบข้อความเดียวกัน (กัน user enumeration)
  if (!user || user.passwordForMock !== password) {
    return mockReject(401, {
      code: "INVALID_CREDENTIALS",
      message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    });
  }
  /* FR-UM-05 — บัญชีที่ถูกระงับเข้าสู่ระบบไม่ได้ ตรงกับ auth.service ของ backend
     ตรวจหลังรหัสผ่านถูกแล้ว จะได้ไม่บอกคนที่ไม่รู้รหัสว่าบัญชีนี้มีอยู่และถูกระงับ */
  if (isStoreUserSuspended(email)) {
    return mockReject(403, {
      code: "ACCOUNT_SUSPENDED",
      message: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
    });
  }

  return mockDelay<LoginResponse>({
    accessToken: `mock-token-${user.id}-${Date.now()}`,
    expiresIn: 604800, // 7 วัน (seconds)
    tokenType: "Bearer",
    user: {
      id: user.id,
      fullName: user.fullName,
      userType: user.userType,
    },
  });
}

/**
 * Mock register — ตรวจ email ว่ามีซ้ำหรือไม่
 * ถ้า email ซ้ำ → mockReject 400 EMAIL_TAKEN พร้อม field error
 * ถ้า unique → สร้าง user ใหม่ + backend ตั้งเองให้ userType='student' (ดู GUIDE/04 §12)
 */
export async function mockRegister(input: RegisterRequest): Promise<RegisterResponse> {
  const email = normalizeEmail(input.email);
  if (mockUsers.some((u) => u.email === email)) {
    return mockReject(400, {
      code: "EMAIL_TAKEN",
      message: "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ",
      fields: { email: "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว" },
    });
  }

  const id = takeNextMockUserId();
  const internal = isKuEmail(email);
  mockUsers.push({
    id,
    fullName: input.fullName,
    email,
    gender: input.gender,
    birthDate: input.birthDate,
    facultyId: internal ? input.facultyId ?? null : null,
    departmentId: internal ? input.departmentId ?? null : null,
    year: internal ? input.year ?? null : null,
    avatarUrl: null,
    contactInfo: null,
    address: null,
    totalPoints: 0,
    notificationPrefs: null,
    createdAt: new Date().toISOString(),
    // BE owns the real classification; mock mode mirrors its exact email-domain rule.
    userType: internal ? 'student' : 'external',
    passwordForMock: input.password,
  });

  localStorage.setItem("ltms-mock-users", JSON.stringify(mockUsers));

  return mockDelay<RegisterResponse>({
    id,
    fullName: input.fullName,
    email: input.email,
    emailVerificationSent: false,
  });
}

export async function mockVerifyEmail(input: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  if (input.code !== "123456") {
    return mockReject(400, { code: "INVALID_OTP", message: "Invalid demo code. Use 123456." });
  }
  return mockDelay({ message: "Demo email verified.", emailVerified: true });
}

export async function mockResendVerification(): Promise<ResendVerificationResponse> {
  return mockDelay({ message: "Demo request received. No email is sent." });
}
