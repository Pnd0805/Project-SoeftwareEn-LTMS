import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { retryPolicy } from '../api/client'
import * as api from '../api/matchWorkflow'
import type { ComplaintDecisionInput, OrganizerResultInput, ResultChallengeInput } from '../types/matchWorkflow.dto'
export function useMatchWorkflow(id: number, readComplaints: boolean, readDispute: boolean) {
  const qc = useQueryClient()
  const refresh = async () => {
    await Promise.all(['match', 'matches', 'standings', 'tournament', 'tournaments', 'liveMvp', 'matchComplaints', 'matchDispute', 'notifications', 'rewards'].map(key => qc.invalidateQueries({ queryKey: [key] })))
  }
  const complaints = useQuery({ queryKey: ['matchComplaints', id], queryFn: () => api.getResultComplaints(id), enabled: readComplaints, retry: retryPolicy })
  const dispute = useQuery({ queryKey: ['matchDispute', id], queryFn: () => api.getMatchDispute(id), enabled: readDispute, retry: retryPolicy })
  const abandon = useMutation({ mutationFn: (reason: string) => api.abandonMatch(id, reason), onSuccess: refresh })
  const organizer = useMutation({ mutationFn: (input: OrganizerResultInput) => api.decideOrganizerResult(id, input), onSuccess: refresh })
  const challenge = useMutation({ mutationFn: (input: ResultChallengeInput) => api.challengeResult(id, input), onSuccess: refresh })
  const file = useMutation({ mutationFn: (input: ResultChallengeInput) => api.fileResultComplaint(id, input), onSuccess: refresh })
  const statement = useMutation({ mutationFn: ({ complaintId, text }: { complaintId: number; text: string }) => api.attachComplaintStatement(complaintId, text), onSuccess: refresh })
  const decision = useMutation({ mutationFn: ({ complaintId, input }: { complaintId: number; input: ComplaintDecisionInput }) => api.decideResultComplaint(complaintId, input), onSuccess: refresh })
  return { complaints, dispute, abandon, organizer, challenge, file, statement, decision }
}
