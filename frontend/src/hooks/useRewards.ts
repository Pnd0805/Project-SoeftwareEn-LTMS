import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { USE_MOCK, retryPolicy } from '../api/client'
import * as api from '../api/rewards'

// Result changes can revoke rewards. Refresh on entry/focus and while open.
const fresh = { staleTime: 0, refetchOnMount: 'always' as const, refetchOnWindowFocus: 'always' as const, refetchInterval: 30_000, retry: retryPolicy }
export function useRewardCatalogue() {
  return useQuery({ queryKey: ['rewards', 'catalogue'], queryFn: api.getRewards, enabled: !USE_MOCK, retry: retryPolicy })
}
export function useMyRewards(userId: number | undefined) {
  return useQuery({ queryKey: ['rewards', 'mine', userId], queryFn: api.getMyRewards, enabled: !USE_MOCK && !!userId, ...fresh })
}
export function useUserRewards(userId: number | undefined) {
  return useQuery({ queryKey: ['rewards', 'user', userId], queryFn: () => api.getUserRewards(userId!), enabled: !USE_MOCK && !!userId, ...fresh })
}
export function useRewardDisplay() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, isDisplayed }: { id: number; isDisplayed: boolean }) => api.setRewardDisplayed(id, isDisplayed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rewards'] }),
    onError: () => qc.invalidateQueries({ queryKey: ['rewards'] }),
  })
}
