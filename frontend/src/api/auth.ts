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
