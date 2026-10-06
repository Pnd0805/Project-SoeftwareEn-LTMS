/**
 * src/api/auth.ts — A01, A02, A03
 * ทุกฟังก์ชัน signature ตรงกับตาราง GUIDE/06 §1 เป๊ะ — สลับ mock/จริงข้างในฟังก์ชันเดียว
 * component/hook ข้างนอกไม่รู้เลยว่าตอนนี้คุยกับ mock หรือ backend จริง
 */
import { apiFetch, setAccessToken, USE_MOCK } from "./client";
import type { RegisterRequest, RegisterResponse, LoginRequest, LoginResponse } from "../types/dto";
import * as authMock from "../mocks/auth.mock";

export async function register(input: RegisterRequest): Promise<RegisterResponse> {
  if (USE_MOCK) {
    return authMock.mockRegister(input);
  }
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const result = USE_MOCK
    ? await authMock.mockLogin(input.email, input.password)
    : await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
  setAccessToken(result.accessToken);
  return result;
}

export async function logout(): Promise<void> {
  if (!USE_MOCK) {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  }
  setAccessToken(null);
}

export async function verifyEmail(input: { email: string; code: string }): Promise<{ message: string; emailVerified: boolean }> {
  if (USE_MOCK) {
    return authMock.mockVerifyEmail(input.email, input.code);
  }
  return apiFetch<{ message: string; emailVerified: boolean }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resendVerification(input: { email: string }): Promise<{ message: string }> {
  if (USE_MOCK) {
    return authMock.mockResendVerification(input.email);
  }
  return apiFetch<{ message: string }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  if (USE_MOCK) throw new Error('Password recovery is available with the live server.');
  return apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<{ message: string }> {
  if (USE_MOCK) throw new Error('Password recovery is available with the live server.');
  return apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify(input) });
}
