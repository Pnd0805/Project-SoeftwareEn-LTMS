/**
 * src/hooks/useAdmin.ts — Person 4 (Admin · Organizer approval · Referee)
 *
 * namespace ของสไลซ์ 4 ตาม PLAN.md: `admin` `organizer` `referees` `audit`
 * (`team`/`teams` อยู่ใน useTeam.ts)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { USE_MOCK, retryPolicy } from "../api/client";
import * as adminApi from "../api/admin";
import type { TeamRef } from "../mocks/teamBridge";
import type {
  ReviewTournamentRequest,
  AppointRefereeRequest,
  AnswerAppointmentRequest,
  GrantAdminScopeRequest,
  SuspendUserRequest,
  AuditLogQuery,
  ReviewExternalRefereeRequest,
} from "../types/admin.dto";

export const adminKeys = {
  tournamentRequests: ["admin", "tournamentRequests"] as const,
  teamRequests: ["admin", "teamRequests"] as const,
  externalReferees: ["admin", "externalReferees"] as const,
  amendments: ["admin", "amendments"] as const,
  myRefereeInvitations: ["referees", "me"] as const,
  users: ["admin", "users"] as const,
  scopes: ["admin", "scopes"] as const,
  audit: (q: AuditLogQuery) => ["audit", q] as const,
  referees: (tid: TeamRef) => ["referees", tid] as const,
  coverage: (tid: TeamRef) => ["referees", tid, "coverage"] as const,
  requests: (tid: TeamRef) => ["referees", tid, "requests"] as const,
};

// ══════════════ queries ══════════════

/**
 * "คนที่ล็อกอินอยู่เป็นแอดมินไหม" — backend ไม่มี endpoint ตอบตรงๆ
 * จึงถามด้วยการลองเปิดคิวที่ต้องเป็นแอดมินถึงจะดูได้ (403 INSUFFICIENT_ADMIN_SCOPE = ไม่ใช่)
 * ใช้คิวคำขอจัดทัวร์นาเมนต์เพราะรับทั้งแอดมินระดับคณะและระดับมหาวิทยาลัย
 * โหมด mock ไม่ต้องถาม — หน้าจออ่าน role จาก store เอง
 */
export function useAdminAccess(enabled = true) {
  return useQuery({
    queryKey: ["admin", "access"] as const,
    queryFn: async () => {
      await adminApi.getTournamentRequests();
      return true;
    },
    enabled: !USE_MOCK && enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeamRequests() {
  return useQuery({
    queryKey: adminKeys.teamRequests,
    queryFn: adminApi.getTeamRequests,
    retry: retryPolicy,
  });
}

export function useMyRefereeInvitations() {
  return useQuery({
    queryKey: adminKeys.myRefereeInvitations,
    queryFn: adminApi.getMyRefereeInvitations,
    retry: retryPolicy,
  });
}

export function useTournamentRequests() {
  return useQuery({
    queryKey: adminKeys.tournamentRequests,
    queryFn: adminApi.getTournamentRequests,
    retry: retryPolicy,
  });
}

/** GET /me/referee-requests — คำขอเปลี่ยน/เพิ่มแมตช์ที่รอเราตอบ (incoming) และที่เรายื่นไว้ (outgoing) */
export function useMyRefereeRequests() {
  return useQuery({
    queryKey: ["referees", "me", "requests"] as const,
    queryFn: adminApi.getMyRefereeRequests,
    enabled: !USE_MOCK,
    retry: retryPolicy,
  });
}

function touchRefereeRequests(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["referees", "me", "requests"] });
  qc.invalidateQueries({ queryKey: ["matches"] });
}

export function useAcceptRefereeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) => adminApi.acceptRefereeRequest(requestId),
    onSuccess: () => touchRefereeRequests(qc),
  });
}

export function useDeclineRefereeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) => adminApi.declineRefereeRequest(requestId),
    onSuccess: () => touchRefereeRequests(qc),
  });
}

/** GET /admin/amendment-requests — คำขอแก้ไขรายการที่รอแอดมิน (C09) */
export function useAmendmentRequests() {
  return useQuery({
    queryKey: adminKeys.amendments,
    queryFn: adminApi.getAmendmentRequests,
    enabled: !USE_MOCK,
    retry: retryPolicy,
  });
}

/** อนุมัติแล้ว backend เขียนค่าที่ขอลงทัวร์นาเมนต์ให้เลย — รายการนั้นจึงต้องอ่านใหม่ด้วย */
function touchAmendments(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: adminKeys.amendments });
  qc.invalidateQueries({ queryKey: ["tournaments"] });
  qc.invalidateQueries({ queryKey: ["tournament"] });
}

export function useApproveAmendment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amendmentId: number) => adminApi.approveAmendmentRequest(amendmentId),
    onSuccess: () => touchAmendments(qc),
  });
}

export function useRejectAmendment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { amendmentId: number; reason: string }) =>
      adminApi.rejectAmendmentRequest(v.amendmentId, v.reason),
    onSuccess: () => touchAmendments(qc),
  });
}

/** คิวคำขอจัดทัวร์นาเมนต์ตามรูปที่ backend ตอบจริง — ใช้กับหน้า Admin ในโหมดจริง */
export function usePendingTournamentRequests() {
  return useQuery({
    queryKey: adminKeys.tournamentRequests,
    queryFn: adminApi.getPendingTournamentRequests,
    enabled: !USE_MOCK,
    retry: retryPolicy,
  });
}

export function useTournamentReferees(tournamentId: TeamRef | undefined) {
  return useQuery({
    queryKey: adminKeys.referees(tournamentId as TeamRef),
    queryFn: () => adminApi.getTournamentReferees(tournamentId as TeamRef),
    enabled: tournamentId !== undefined,
    retry: retryPolicy,
  });
}

/** FR05 — organizer-visible assignment requests, including open and resolved rows. */
export function useTournamentRefereeRequests(tournamentId: TeamRef | undefined) {
  return useQuery({
    queryKey: adminKeys.requests(tournamentId as TeamRef),
    queryFn: () => adminApi.getTournamentRefereeRequests(Number(tournamentId)),
    enabled: !USE_MOCK && tournamentId !== undefined,
    retry: retryPolicy,
  });
}

/** FR02 — request one active tournament referee for one scheduled match. */
export function useRequestMatchReferee(tournamentId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tournamentRefereeId: number; matchId: number }) =>
      adminApi.requestMatchReferee(Number(tournamentId), input.tournamentRefereeId, input.matchId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminKeys.requests(tournamentId) }),
        qc.invalidateQueries({ queryKey: ["match"] }),
        qc.invalidateQueries({ queryKey: ["matches"] }),
      ]);
    },
  });
}

export function useCancelTournamentRefereeRequest(tournamentId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.cancelRefereeRequest,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.requests(tournamentId) });
    },
  });
}

/** FR-RM-03 — ครบ 2 คนหรือยัง ตัวเดียวกับที่กั้นการบันทึกสถิติในสไลซ์ 3 */
export function useRefereeCoverage(tournamentId: TeamRef | undefined) {
  return useQuery({
    queryKey: adminKeys.coverage(tournamentId as TeamRef),
    queryFn: () => adminApi.getRefereeCoverage(tournamentId as TeamRef),
    enabled: tournamentId !== undefined,
    retry: retryPolicy,
  });
}

/** FR-RM-02 — บุคคลภายนอกที่ตอบรับแล้วและรอ Admin อนุมัติ */
export function useExternalRefereeRequests() {
  return useQuery({
    queryKey: adminKeys.externalReferees,
    queryFn: adminApi.getExternalRefereeRequests,
    retry: retryPolicy,
  });
}

export function useUsersForAdmin() {
  return useQuery({ queryKey: adminKeys.users, queryFn: adminApi.getUsersForAdmin, retry: retryPolicy });
}

export function useAdminScopes() {
  return useQuery({ queryKey: adminKeys.scopes, queryFn: adminApi.getAdminScopes, retry: retryPolicy });
}

export function useAuditLogs(query: AuditLogQuery = {}) {
  return useQuery({
    queryKey: adminKeys.audit(query),
    queryFn: () => adminApi.getAuditLogs(query),
    retry: retryPolicy,
  });
}

// ══════════════ mutations ══════════════

export function useApproveTeamRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: TeamRef) => adminApi.approveTeamRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.teamRequests });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });
}

export function useRejectTeamRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { requestId: TeamRef; reason: string }) =>
      adminApi.rejectTeamRequest(v.requestId, v.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.teamRequests });
    },
  });
}

/** ตอบรับแล้วรายชื่อกรรมการเปลี่ยน — และถ้าเป็นบุคคลภายนอก คิวของ Admin ยาวขึ้น */
function touchRefereeAnswer(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: adminKeys.myRefereeInvitations });
  qc.invalidateQueries({ queryKey: adminKeys.externalReferees });
  qc.invalidateQueries({ queryKey: ["referees"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function useAcceptRefereeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: TeamRef) => adminApi.acceptRefereeInvitation(invitationId),
    onSuccess: () => touchRefereeAnswer(qc),
  });
}

export function useDeclineRefereeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: TeamRef) => adminApi.declineRefereeInvitation(invitationId),
    onSuccess: () => touchRefereeAnswer(qc),
  });
}

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
  /* การกระทำเหล่านี้แจ้งเตือนผู้ใช้ — กระดิ่งบน Shell ต้องอ่านใหม่ */
  qc.invalidateQueries({ queryKey: ["notifications"] });
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

/**
 * ถอดกรรมการ (ทำได้ทุกเมื่อ) — คนนั้นหลุดจากแมตช์ที่ยังไม่จบ และคำเชิญหายจากกล่องของเขา
 * จึงล้าง match/matches ของสไลซ์ 3 และคิวกรรมการภายนอกของ Admin ด้วย ไม่งั้นหน้าแมตช์
 * ยังให้คนที่ถูกถอดกดบันทึกผลได้จนกว่าจะเปลี่ยนหน้า
 */
export function useRemoveReferee(tournamentId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => adminApi.removeReferee(tournamentId, userId),
    onSuccess: () => {
      touchReferees(qc, tournamentId);
      qc.invalidateQueries({ queryKey: ["referees"] });
      qc.invalidateQueries({ queryKey: adminKeys.externalReferees });
      qc.invalidateQueries({ queryKey: ["match"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

/**
 * FR-RM-02 — Admin ตัดสินกรรมการภายนอก
 * อนุมัติแล้วคนนั้นนับเป็นกรรมการของรายการ จำนวนที่ RefereePanel/SetupTrail อ่านจึงเปลี่ยน
 */
export function useReviewExternalReferee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { requestId: TeamRef; input: ReviewExternalRefereeRequest }) =>
      adminApi.reviewExternalReferee(v.requestId, v.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.externalReferees });
      qc.invalidateQueries({ queryKey: ["referees"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useGrantAdminScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantAdminScopeRequest) => adminApi.grantAdminScope(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.scopes });
      qc.invalidateQueries({ queryKey: adminKeys.users });
      qc.invalidateQueries({ queryKey: ["notifications"] });
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
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
