/**
 * src/hooks/useTeam.ts — Person 4 (Teams)
 *
 * ชั้นเดียวที่ feature component เรียก — ไม่มี component ไหน import api/team.ts ตรงๆ
 *
 * query key namespace ของสไลซ์ 4 ตาม PLAN.md: `team` `teams` `admin`
 * (สไลซ์ 1 ใช้ `me`/`auth`/… · สไลซ์ 2 ใช้ `tournament*` · สไลซ์ 3 ใช้ `match*`)
 *
 * ── กฎ invalidate ที่พลาดไม่ได้ ────────────────────────────────────────────
 * ตอบรับคำเชิญ = สมาชิกทีมเปลี่ยน + รายการทีมของฉันเปลี่ยน + คำเชิญเปลี่ยน
 * อนุมัติคำร้อง Official = ทีมเปลี่ยนสถานะ + คิว Admin เปลี่ยน
 * ทำเป็น helper ไว้ จะได้ไม่ลืมสัก key
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import * as teamApi from "../api/team";
import type { TeamRef } from "../mocks/teamBridge";
import type {
  CreateTeamRequest,
  UpdateTeamRequest,
  SetMemberPositionRequest,
  InviteMemberRequest,
  RequestOfficialStatusRequest,
  TransferLeaderRequest,
  ReviewTeamRequestRequest,
} from "../types/team.dto";

export const teamKeys = {
  all: ["teams"] as const,
  mine: ["teams", "mine"] as const,
  detail: (id: TeamRef) => ["team", id] as const,
  invitations: (id: TeamRef) => ["team", id, "invitations"] as const,
  myInvitations: ["teams", "invitations", "mine"] as const,
  adminRequests: ["admin", "teamRequests"] as const,
  player: (id: TeamRef) => ["team", "player", id] as const,
};

/** ทุกอย่างที่แตะสมาชิกทีมสะเทือนสามที่เสมอ */
function touchTeam(qc: QueryClient, teamId?: TeamRef) {
  if (teamId !== undefined) {
    qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
    qc.invalidateQueries({ queryKey: teamKeys.invitations(teamId) });
  }
  qc.invalidateQueries({ queryKey: teamKeys.mine });
  qc.invalidateQueries({ queryKey: teamKeys.myInvitations });
}

// ══════════════ queries ══════════════

export function useMyTeams() {
  return useQuery({ queryKey: teamKeys.mine, queryFn: teamApi.getMyTeams });
}

export function useTeam(teamId: TeamRef | undefined) {
  return useQuery({
    queryKey: teamKeys.detail(teamId as TeamRef),
    queryFn: () => teamApi.getTeam(teamId as TeamRef),
    enabled: teamId !== undefined,
  });
}

export function useMyInvitations() {
  return useQuery({ queryKey: teamKeys.myInvitations, queryFn: teamApi.getMyInvitations });
}

export function useTeamInvitations(teamId: TeamRef | undefined) {
  return useQuery({
    queryKey: teamKeys.invitations(teamId as TeamRef),
    queryFn: () => teamApi.getTeamInvitations(teamId as TeamRef),
    enabled: teamId !== undefined,
  });
}

export function useTeamAdminRequests() {
  return useQuery({ queryKey: teamKeys.adminRequests, queryFn: teamApi.getTeamAdminRequests });
}

export function usePlayerProfile(userId: TeamRef | undefined) {
  return useQuery({
    queryKey: teamKeys.player(userId as TeamRef),
    queryFn: () => teamApi.getPlayerProfile(userId as TeamRef),
    enabled: userId !== undefined,
  });
}

// ══════════════ mutations ══════════════

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamRequest) => teamApi.createTeam(input),
    onSuccess: () => touchTeam(qc),
  });
}

export function useUpdateTeam(teamId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTeamRequest) => teamApi.updateTeam(teamId, input),
    onSuccess: () => touchTeam(qc, teamId),
  });
}

export function useSetMemberPosition(teamId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetMemberPositionRequest) => teamApi.setMemberPosition(teamId, input),
    onSuccess: () => touchTeam(qc, teamId),
  });
}

export function useKickMember(teamId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => teamApi.kickMember(teamId, userId),
    onSuccess: () => touchTeam(qc, teamId),
  });
}

export function useInviteMember(teamId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteMemberRequest) => teamApi.inviteMember(teamId, input),
    onSuccess: () => touchTeam(qc, teamId),
  });
}

/** ตอบรับแล้วสมาชิกทีมเปลี่ยน — invalidate ทั้งคำเชิญและทีม */
export function useAnswerInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { invitationId: TeamRef; accept: boolean }) =>
      teamApi.answerInvitation(v.invitationId, v.accept),
    onSuccess: () => touchTeam(qc),
  });
}

export function useDisbandTeam(teamId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => teamApi.disbandTeam(teamId),
    onSuccess: () => touchTeam(qc, teamId),
  });
}

export function useRequestOfficialStatus(teamId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestOfficialStatusRequest) => teamApi.requestOfficialStatus(teamId, input),
    onSuccess: () => {
      touchTeam(qc, teamId);
      qc.invalidateQueries({ queryKey: teamKeys.adminRequests });
    },
  });
}

export function useTransferLeader(teamId: TeamRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransferLeaderRequest) => teamApi.transferLeader(teamId, input),
    onSuccess: () => {
      touchTeam(qc, teamId);
      qc.invalidateQueries({ queryKey: teamKeys.adminRequests });
    },
  });
}

/** Admin ตัดสิน — ทีมเปลี่ยนสถานะและคิวสั้นลง */
export function useReviewTeamRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { requestId: TeamRef; input: ReviewTeamRequestRequest }) =>
      teamApi.reviewTeamRequest(v.requestId, v.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.adminRequests });
      qc.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}
