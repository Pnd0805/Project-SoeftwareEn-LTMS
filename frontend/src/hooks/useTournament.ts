import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import * as tournamentApi from "../api/tournament";
import { USE_MOCK } from "../api/client";
import type { TournamentRef } from "../mocks/tournamentWrites";
import type {
  ApplyToTournamentRequest,
  AmendmentRequestPayload,
  CreateEligibilityRuleRequest,
  InviteTournamentRefereeRequest,
  ReviewTournamentApplicationRequest,
  UpdateTournamentRequest,
  CreateTournamentAnnouncementRequest,
  SubmitTournamentFeedbackRequest,
} from "../types/tournament.dto";
import type { TournamentStatus } from "../types/enums";

export const tournamentKeys = {
  all: ["tournaments"] as const,
  list: (filters: { status?: string; sportTypeId?: number } = {}) => ["tournaments", "list", filters] as const,
  detail: (id: number) => ["tournament", id] as const,
  application: (id: number) => ["application", id] as const,
};

export function useTournaments(filters: { status?: TournamentStatus; sportTypeId?: number } = {}) {
  return useQuery({
    queryKey: tournamentKeys.list(filters),
    queryFn: () => tournamentApi.getTournaments(filters),
  });
}

export function useTournament(id: number | undefined) {
  return useQuery({
    queryKey: tournamentKeys.detail(id as number),
    queryFn: () => tournamentApi.getTournament(id as number),
    enabled: id !== undefined,
    retry: false,
  });
}

/** Organizer-only application query supported by the current backend. */
export function useTournamentApplications(id: number | undefined) {
  return useQuery({
    queryKey: ["tournament", id, "applications"],
    queryFn: () => tournamentApi.getTournamentApplications(id as number),
    enabled: id !== undefined,
    retry: false,
  });
}

/** Organizer/team-leader detail, including the submitted player list. */
export function useApplicationDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: tournamentKeys.application(id as number),
    queryFn: () => tournamentApi.getApplicationDetail(id as number),
    enabled: id !== undefined && enabled && !USE_MOCK,
    retry: false,
  });
}

/**
 * รายละเอียดของหลายรายการพร้อมกัน — ใช้เติมรายการที่ GET /tournaments ไม่คืนมา
 *
 * ⚠️ GET /tournaments คืนเฉพาะรายการที่ public เท่านั้น รายการของเราเองที่ยัง
 *    private (เพิ่งผ่าน admin ยังไม่กดเปิด) หรือที่ completed แล้ว จึงไม่อยู่ในนั้น
 *    เจ้าของหาของตัวเองไม่เจอในหน้าแรกทั้งที่เพิ่งสร้างไปเอง
 *    GET /me/tournament-requests บอกแค่ id/ชื่อ/สถานะ ไม่พอวาดการ์ด จึงต้องตาม
 *    ขอ detail เป็นรายอัน — N+1 ที่หลีกไม่ได้จนกว่าจะมี /me/tournaments ที่ข้อมูลครบ
 *    (ดู BACKEND-GAPS) จำกัดจำนวนไว้กันคนที่จัดรายการเยอะยิงรัว
 */
export function useTournamentsByIds(ids: number[], limit = 12) {
  const wanted = ids.slice(0, limit);
  return useQueries({
    queries: wanted.map((id) => ({
      queryKey: tournamentKeys.detail(id),
      queryFn: () => tournamentApi.getTournament(id),
      enabled: !USE_MOCK,
      retry: false,
    })),
  });
}

/**
 * GET /me/tournament-requests — รายการที่เรายื่นขอจัด (รวมที่อนุมัติแล้ว)
 * ใช้ตอบคำถาม "รายการไหนเป็นของฉัน" ซึ่งรายการสาธารณะไม่ได้บอกมาด้วย
 */
export function useMyTournamentRequests() {
  return useQuery({
    queryKey: ["me", "tournament-requests"],
    queryFn: tournamentApi.getMyTournamentRequests,
    enabled: !USE_MOCK,
    retry: false,
  });
}

/** GET /tournaments/:id/eligibility-rules — เงื่อนไขคณะ/ชั้นปีของรายการ (อ่านอย่างเดียว) */
export function useEligibilityRules(id: number | undefined) {
  return useQuery({
    queryKey: ["tournament", id, "eligibility-rules"],
    queryFn: () => tournamentApi.getEligibilityRules(id as number),
    enabled: id !== undefined,
    retry: false,
  });
}

/** Public approved-team list supported by GET /tournaments/:id/teams. */
export function useTournamentTeams(id: number | undefined) {
  return useQuery({
    queryKey: ["tournament", id, "teams"],
    queryFn: () => tournamentApi.getTournamentTeams(id as number),
    enabled: id !== undefined,
    retry: false,
  });
}

export function useMyTournamentApplications(enabled = true) {
  return useQuery({
    queryKey: ["me", "applications"],
    queryFn: tournamentApi.getMyApplications,
    enabled,
    retry: false,
  });
}

export function useCancelMyApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentApi.cancelMyApplication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "applications"] }),
  });
}

export function useWithdrawMyApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentApi.withdrawMyApplication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "applications"] }),
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentApi.createTournament,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tournamentKeys.all }),
  });
}

export function useUpdateTournament(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTournamentRequest) => tournamentApi.updateTournament(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: tournamentKeys.all });
    },
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentApi.deleteTournament,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: tournamentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: tournamentKeys.all });
    },
  });
}

export function useAddEligibilityRule(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEligibilityRuleRequest) => tournamentApi.addEligibilityRule(tournamentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) }),
  });
}

export function useRemoveEligibilityRule(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: number) => tournamentApi.removeEligibilityRule(tournamentId, ruleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) }),
  });
}

export function useInviteTournamentReferee(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteTournamentRefereeRequest) => tournamentApi.inviteReferee(tournamentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) }),
  });
}

export function useApplyToTournament(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyToTournamentRequest) => tournamentApi.applyToTournament(tournamentId, input),
    onSuccess: () => invalidateTournament(queryClient, tournamentId),
  });
}

export function useReviewTournamentApplication(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: { applicationId: number; input: ReviewTournamentApplicationRequest }) =>
      tournamentApi.reviewApplication(tournamentId, value.applicationId, value.input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) }),
  });
}

function invalidateTournament(queryClient: ReturnType<typeof useQueryClient>, id: TournamentRef) {
  /* id สองระบบอีกเช่นเคย — ล้างทั้ง namespace ให้หน้าที่ถือ id คนละแบบอัปเดตด้วย
     รวมถึงตารางแมตช์กับตารางคะแนน เพราะการจับสายสร้างแมตช์ใหม่ทั้งชุด */
  queryClient.invalidateQueries({ queryKey: ["tournament"] });
  queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  queryClient.invalidateQueries({ queryKey: ["match"] });
  queryClient.invalidateQueries({ queryKey: ["matches"] });
  queryClient.invalidateQueries({ queryKey: ["standings"] });
  void id;
  return Promise.resolve();
}

export function useApproveRegistration(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (applicationId: TournamentRef) => tournamentApi.approveApplication(tournamentId, applicationId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useRejectRegistration(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (value: { applicationId: TournamentRef; rejectionReason: string }) => tournamentApi.rejectApplication(tournamentId, value.applicationId, value.rejectionReason), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useApproveAllRegistrations(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => tournamentApi.approveAllApplications(tournamentId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useAllowWithdrawal(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (applicationId: TournamentRef) => tournamentApi.allowApplicationWithdrawal(tournamentId, applicationId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

/* ทุกตัวข้างล่างรับ id ได้ทั้งตัวเลขของ DTO และ string ของ store — เดิมรับแค่ number
   หน้าจอจึงแปลงด้วย Number() แล้วได้ NaN กับทัวร์นาเมนต์ใน seed ปุ่มกดแล้วเงียบ */
export function usePublishTournament(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => tournamentApi.publishTournament(tournamentId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useDrawTournament(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: tournamentApi.drawTournament.bind(null, tournamentId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useCreateTournamentAnnouncement(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTournamentAnnouncementRequest) => tournamentApi.createAnnouncement(tournamentId, input),
    onSuccess: () => {
      invalidateTournament(queryClient, tournamentId);
      /* แจ้งหัวหน้าทีมด้วย กระดิ่งจึงต้องอ่านใหม่ · ล้างทั้ง namespace เพราะ id มีได้สองแบบ */
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useTournamentAnnouncements(tournamentId: TournamentRef | undefined) {
  return useQuery({
    queryKey: ["announcements", tournamentId],
    queryFn: () => tournamentApi.getAnnouncements(tournamentId as TournamentRef),
    enabled: tournamentId !== undefined,
  });
}

export function useSubmitTournamentFeedback(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: SubmitTournamentFeedbackRequest) => tournamentApi.submitFeedback(tournamentId, input), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useSaveEntryNotes(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (text: string) => tournamentApi.saveEntryNotes(tournamentId, text), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useRequestFilterChange(tournamentId: TournamentRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { rules: unknown; reason: string; changes?: AmendmentRequestPayload }) =>
      tournamentApi.requestFilterChange(tournamentId, input),
    onSuccess: () => invalidateTournament(queryClient, tournamentId),
  });
}
