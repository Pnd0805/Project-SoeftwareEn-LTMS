/**
 * src/api/auth.ts — A01, A02, A03
 * ทุกฟังก์ชัน signature ตรงกับตาราง GUIDE/06 §1 เป๊ะ — สลับ mock/จริงข้างในฟังก์ชันเดียว
 * component/hook ข้างนอกไม่รู้เลยว่าตอนนี้คุยกับ mock หรือ backend จริง
 */
import { apiFetch, mockDelay, mockReject, setAccessToken, USE_MOCK } from "./client";
import type { RegisterRequest, RegisterResponse, LoginRequest, LoginResponse } from "../types/dto";
import { mockUsers, takeNextMockUserId } from "../mocks/user.mock";

export async function register(input: RegisterRequest): Promise<RegisterResponse> {
  if (USE_MOCK) {
    if (mockUsers.some((u) => u.email === input.email)) {
      return mockReject(400, {
        code: "EMAIL_TAKEN",
        message: "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ",
        fields: { email: "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว" },
      });
    }
    const id = takeNextMockUserId();
    mockUsers.push({
      id,
      fullName: input.fullName,
      email: input.email,
      gender: input.gender,
      birthDate: input.birthDate,
      facultyId: input.facultyId,
      departmentId: input.departmentId,
      year: input.year,
      avatarUrl: null,
      contactInfo: null,
      address: null,
      totalPoints: 0,
      notificationPrefs: null,
      createdAt: new Date().toISOString(),
      // GUIDE/04 §12: A01 ไม่รับ userType จาก request แต่ DB บังคับ NOT NULL
      // backend ตั้ง 'student' ไปก่อน (ดู GUIDE/07) — mock ทำตามเดียวกันเพื่อพฤติกรรมตรงกัน
      userType: "student",
      passwordForMock: input.password,
    });
    return mockDelay({ id, fullName: input.fullName, email: input.email });
  }
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  let result: LoginResponse;
  if (USE_MOCK) {
    const user = mockUsers.find((u) => u.email === input.email);
    // GUIDE/04 §12: หาไม่เจอ กับ รหัสผิด ต้องตอบข้อความเดียวกัน (กัน user enumeration)
    if (!user || user.passwordForMock !== input.password) {
      return mockReject(401, { code: "INVALID_CREDENTIALS", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }
    result = await mockDelay({
      accessToken: `mock-token-${user.id}`,
      expiresIn: 604800,
      tokenType: "Bearer" as const,
      user: { id: user.id, fullName: user.fullName, userType: user.userType },
    });
  } else {
    result = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  setAccessToken(result.accessToken);
  return result;
}

export async function logout(): Promise<void> {
  if (!USE_MOCK) {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  }
  setAccessToken(null);
}
