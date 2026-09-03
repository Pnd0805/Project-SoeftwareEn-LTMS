/**
 * src/hooks/useAdmin.ts — Person 4 (Admin · Organizer approval · Referee)
 *
 * namespace ของสไลซ์ 4 ตาม PLAN.md: `admin` `organizer` `referees` `audit`
 * (`team`/`teams` อยู่ใน useTeam.ts)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as adminApi from "../api/admin";
import type { TeamRef } from "../mocks/teamBridge";
import type {
  ReviewTournamentRequest,
  AppointRefereeRequest,
  AnswerAppointmentRequest,
  GrantAdminScopeRequest,
  SuspendUserRequest,
  AuditLogQuery,
} from "../types/admin.dto";

export const adminKeys = {
  tournamentRequests: ["admin", "tournamentRequests"] as const,
  users: ["admin", "users"] as const,
  scopes: ["admin", "scopes"] as const,
  audit: (q: AuditLogQuery) => ["audit", q] as const,
  referees: (tid: TeamRef) => ["referees", tid] as const,
  coverage: (tid: TeamRef) => ["referees", tid, "coverage"] as const,
};

// ══════════════ queries ══════════════

export function useTournamentRequests() {
  return useQuery({
    queryKey: adminKeys.tournamentRequests,
    queryFn: adminApi.getTournamentRequests,
  });
}

export function useTournamentReferees(tournamentId: TeamRef | undefined) {
  return useQuery({
    queryKey: adminKeys.referees(tournamentId as TeamRef),
    queryFn: () => adminApi.getTournamentReferees(tournamentId as TeamRef),
    enabled: tournamentId !== undefined,
  });
}

/** FR-RM-03 — ครบ 2 คนหรือยัง ตัวเดียวกับที่กั้นการบันทึกสถิติในสไลซ์ 3 */
export function useRefereeCoverage(tournamentId: TeamRef | undefined) {
  return useQuery({
    queryKey: adminKeys.coverage(tournamentId as TeamRef),
    queryFn: () => adminApi.getRefereeCoverage(tournamentId as TeamRef),
    enabled: tournamentId !== undefined,
  });
}

export function useUsersForAdmin() {
  return useQuery({ queryKey: adminKeys.users, queryFn: adminApi.getUsersForAdmin });
}

export function useAdminScopes() {
  return useQuery({ queryKey: adminKeys.scopes, queryFn: adminApi.getAdminScopes });
}

export function useAuditLogs(query: AuditLogQuery = {}) {
  return useQuery({
    queryKey: adminKeys.audit(query),
    queryFn: () => adminApi.getAuditLogs(query),
  });
}

// ══════════════ mutations ══════════════

/** อนุมัติแล้วทัวร์นาเมนต์เกิดใหม่ — คิวสั้นลง และรายการทัวร์นาเมนต์ของสไลซ์ 2 เปลี่ยน */
export function useReviewTournamentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { requestId: TeamRef; input: ReviewTournamentRequest }) =>
      adminApi.reviewTournamentRequest(v.requestId, v.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.tournamentRequests });
      /* ทัวร์นาเมนต์ใหม่โผล่ในรายการของสไลซ์ 2 — invalidate ข้าม namespace
         ตรงนี้จำเป็นจริง เพราะ FR-TC-03 สร้างระเบียนใหม่ ไม่ใช่แค่เปลี่ยนสถานะคำขอ */
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}

/** เชิญ ถอด หรือตอบรับ ล้วนเปลี่ยนทั้งรายชื่อและจำนวนที่ FR-RM-03 นับ */
function touchReferees(qc: ReturnType<typeof useQueryClient>, tid: TeamRef) {
  qc.invalidateQueries({ queryKey: adminKeys.referees(tid) });
  qc.invalidateQueries({ queryKey: adminKeys.coverage(tid) });
}

export function useAppointReferee(tournamentId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AppointRefereeRequest) => adminApi.appointReferee(tournamentId, input),
    onSuccess: () => touchReferees(qc, tournamentId),
  });
}

export function useAnswerAppointment(tournamentId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { appointmentId: TeamRef; input: AnswerAppointmentRequest }) =>
      adminApi.answerAppointment(v.appointmentId, v.input),
    onSuccess: () => touchReferees(qc, tournamentId),
  });
}

export function useRemoveReferee(tournamentId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => adminApi.removeReferee(tournamentId, userId),
    onSuccess: () => touchReferees(qc, tournamentId),
  });
}

export function useApproveExternalReferee(tournamentId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { refereeId: TeamRef; approve: boolean }) =>
      adminApi.approveExternalReferee(v.refereeId, v.approve),
    onSuccess: () => touchReferees(qc, tournamentId),
  });
}

export function useGrantAdminScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantAdminScopeRequest) => adminApi.grantAdminScope(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.scopes });
      qc.invalidateQueries({ queryKey: adminKeys.users });
    },
  });
}

export function useRevokeAdminScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scopeId: TeamRef) => adminApi.revokeAdminScope(scopeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.scopes });
      qc.invalidateQueries({ queryKey: adminKeys.users });
    },
  });
}

/**
 * ระงับบัญชีแล้วคนนั้นไม่นับเป็นสมาชิกทีมที่ลงแข่งได้อีก (FR-UM-05)
 * ทีมทุกทีมที่เขาอยู่จึงเปลี่ยนความพร้อม — invalidate ฝั่ง teams ด้วย
 */
export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: TeamRef; input: SuspendUserRequest }) =>
      adminApi.suspendUser(v.userId, v.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
