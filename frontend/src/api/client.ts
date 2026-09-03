/**
 * src/api/client.ts
 *
 * ตัวกลางเดียวที่คุยกับ backend — component/hook ไม่เรียก fetch() ตรงๆ เด็ดขาด
 * สลับ mock ↔ ของจริงด้วย env เดียว: VITE_USE_MOCK
 *   .env.local  →  VITE_USE_MOCK=true          (ยังไม่มี backend ให้ยิง)
 *                  VITE_USE_MOCK=false          (backend Step 1 เสร็จแล้ว ต่อจริง)
 *                  VITE_API_BASE_URL=http://localhost:8000/api/v1
 *
 * Auth header ตรงตาม GUIDE/04 §9: "Authorization: Bearer <accessToken>"
 */
import type { ApiErrorBody } from "../types/dto";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false"; // ไม่ตั้งค่า = mock ไว้ก่อน ปลอดภัยสุด
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.code = body.code;
    this.status = status;
    this.fields = body.fields;
  }
}

/**
 * ควรลองยิงซ้ำไหมเมื่อพลาด — ใช้กับ `retry` ของ useQuery ทุกตัว
 *
 * ค่าเริ่มต้นของ TanStack คือลองซ้ำ 3 ครั้ง หน่วง 1s→2s→4s ซึ่งเหมาะกับเน็ตสะดุด
 * แต่กับ 404/403/501 มันคือการรอ ~8 วินาทีเพื่อได้คำตอบเดิม ผู้ใช้เห็นแต่วงกลมหมุน
 * กว่าจะขึ้นว่า "ไม่พบ" — ยิงซ้ำก็ไม่ทำให้ของที่ไม่มีอยู่โผล่มา
 *
 * เกณฑ์: 4xx กับ 501 คือคำตอบสุดท้าย ไม่ลองซ้ำ · 5xx กับ network error ลองอีก 2 ครั้ง
 */
export function retryPolicy(failureCount: number, error: unknown): boolean {
  const status = statusOf(error);
  if (status !== null && (status < 500 || status === 501)) return false;
  return failureCount < 2;
}

/**
 * อ่าน HTTP status จาก error โดยดูที่ "รูปร่าง" ไม่ใช่ `instanceof ApiError`
 *
 * ระหว่างพัฒนา HMR โหลด client.ts ใหม่ได้ ทำให้มีคลาส ApiError สองชุดพร้อมกัน
 * error ที่ throw จากชุดเก่าจะไม่ `instanceof` ชุดใหม่ — เช็คแบบนั้นจึงหลุดเงียบๆ
 * แล้วกลับไป retry 404 เหมือนเดิม (ยืนยันแล้วว่าเกิดขึ้นจริงในเบราว์เซอร์)
 */
function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, (body as ApiErrorBody) ?? { code: "UNKNOWN", message: "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" });
  }
  return body as T;
}

// จำลอง network delay ตอนใช้ mock จะได้เห็น loading state ของจริงระหว่างพัฒนา (TanStack Query isPending ใช้งานได้จริง)
export function mockDelay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function mockReject<T>(status: number, body: ApiErrorBody, ms = 300): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  throw new ApiError(status, body);
}
