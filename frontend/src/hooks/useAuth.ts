/**
 * src/hooks/useAuth.ts — TanStack Query hooks คุยกับ src/api/auth.ts + user.ts เท่านั้น
 * component เรียกแค่ hook พวกนี้ ไม่ import ../api/* ตรงๆ
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import * as userApi from "../api/user";
import { USE_MOCK } from "../api/client";
import type { LoginRequest, RegisterRequest } from "../types/dto";
import type { User } from "../shared/types";
import { getState, login as setLegacySession, signout as clearLegacySession } from "../shared/store";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: userApi.getMe,
    retry: false, // 401 ไม่ต้อง retry — แปลว่ายังไม่ได้ล็อกอิน ไม่ใช่ network error
    /**
     * ห้ามยิงใหม่ตอนมี observer เพิ่ม ไม่งั้นผู้ที่ยังไม่ล็อกอินจะเจอหน้าขาวถาวร
     *
     * queryObserver.js:317 — query ที่ status เป็น error และยังไม่มี data จะถูกยิงใหม่
     * ทุกครั้งที่มี observer mount เว้นแต่ตั้งค่านี้ ซึ่งพอรวมกับ `if (isLoading) return null`
     * ใน Guard แล้วกลายเป็นลูป: 401 → Guard คืน null → Shell ถูกถอด → settle → Shell
     * mount ใหม่ → useMe() ตัวใน Shell ยิงซ้ำ → 401 → วนราว 30 รอบต่อวินาที
     * ผลคือหน้าแรกว่างเปล่าโดยไม่มี error ให้เห็นเลย
     */
    retryOnMount: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) => authApi.login(input),
    onSuccess: async (data, input) => {
      if (USE_MOCK) {
        userApi.setMockCurrentUser(data.user.id);
        // Temporary bridge: legacy screens still read the prototype session.
        const state = getState();
        let legacyUser = state.users.find(
          (user) => user.email.trim().toLowerCase() === input.email.trim().toLowerCase(),
        );
        if (!legacyUser) {
          const newUser: User = {
            id: String(data.user.id),
            name: data.user.fullName,
            email: input.email.trim().toLowerCase(),
            role: data.user.userType === "staff" ? "Admin" : "User",
            gender: "Male",
            dob: "2000-01-01",
            faculty: "—",
            major: "—",
            year: 1,
          };
          state.users.push(newUser);
          legacyUser = newUser;
        }
        setLegacySession(legacyUser.id);
      } else {
        // The legacy prototype can still contain a persisted "guest" session.
        // Real authentication is owned by /me, so do not let that stale marker
        // keep the shell in guest mode after the backend accepted the login.
        clearLegacySession();
      }
      // Wait until the authenticated profile is in the cache before LoginPage
      // navigates. This avoids rendering the destination with the old 401 state.
      await qc.fetchQuery({ queryKey: ["me"], queryFn: userApi.getMe });
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
