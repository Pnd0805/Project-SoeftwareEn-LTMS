import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as tournamentApi from "../api/tournament";
import type {
  ApplyToTournamentRequest,
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

export function useApplyToTournament(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyToTournamentRequest) => tournamentApi.applyToTournament(tournamentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) }),
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

function invalidateTournament(queryClient: ReturnType<typeof useQueryClient>, id: number) {
  return queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
}

export function useApproveRegistration(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (applicationId: number) => tournamentApi.approveApplication(tournamentId, applicationId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useRejectRegistration(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (value: { applicationId: number; rejectionReason: string }) => tournamentApi.rejectApplication(tournamentId, value.applicationId, value.rejectionReason), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useApproveAllRegistrations(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => tournamentApi.approveAllApplications(tournamentId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useAllowWithdrawal(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (applicationId: number) => tournamentApi.allowApplicationWithdrawal(tournamentId, applicationId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function usePublishTournament(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => tournamentApi.publishTournament(tournamentId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useDrawTournament(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: tournamentApi.drawTournament.bind(null, tournamentId), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useCreateTournamentAnnouncement(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: CreateTournamentAnnouncementRequest) => tournamentApi.createAnnouncement(tournamentId, input), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useSubmitTournamentFeedback(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: SubmitTournamentFeedbackRequest) => tournamentApi.submitFeedback(tournamentId, input), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useSaveEntryNotes(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (text: string) => tournamentApi.saveEntryNotes(tournamentId, text), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}

export function useRequestFilterChange(tournamentId: number) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { rules: unknown; reason: string }) => tournamentApi.requestFilterChange(tournamentId, input), onSuccess: () => invalidateTournament(queryClient, tournamentId) });
}
