/**
 * src/hooks/useAuth.ts — TanStack Query hooks คุยกับ src/api/auth.ts + user.ts เท่านั้น
 * component เรียกแค่ hook พวกนี้ ไม่ import ../api/* ตรงๆ
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import * as userApi from "../api/user";
import { USE_MOCK } from "../api/client";
import type { LoginRequest, RegisterRequest } from "../types/dto";
import { getState, login as setLegacySession, signout as clearLegacySession } from "../shared/store";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: userApi.getMe,
    retry: false, // 401 ไม่ต้อง retry — แปลว่ายังไม่ได้ล็อกอิน ไม่ใช่ network error
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) => authApi.login(input),
    onSuccess: (data, input) => {
      if (USE_MOCK) {
        userApi.setMockCurrentUser(data.user.id);
        // Temporary bridge: legacy screens still read the prototype session.
        const legacyUser = getState().users.find((user) => user.email === input.email);
        if (legacyUser) setLegacySession(legacyUser.id);
      }
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterRequest) => authApi.register(input),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      if (USE_MOCK) {
        userApi.setMockCurrentUser(null);
        clearLegacySession();
      }
      qc.clear(); // ล้าง cache ทั้งหมด กัน user ถัดไปเห็นข้อมูลค้าง
    },
  });
}
