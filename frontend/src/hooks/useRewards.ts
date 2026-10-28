import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, retryPolicy } from '../api/client'
import * as api from '../api/rewards'
import type { MeDto } from '../types/dto'

// Result changes can revoke rewards. Refresh on entry/focus and while open.
const fresh = {
  staleTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: 'always' as const,
  refetchInterval: 30_000,
  retry: retryPolicy,
}

export function useRewardCatalogue() {
  return useQuery({
    queryKey: ['rewards', 'catalogue'],
    queryFn: api.getRewards,
    retry: retryPolicy,
  })
}

export function useMyRewards(userId: number | undefined) {
  return useQuery({
    queryKey: ['rewards', 'mine', userId],
    queryFn: api.getMyRewards,
    enabled: !!userId,
    ...fresh,
  })
}

export function useUserRewards(userId: number | undefined) {
  return useQuery({
    queryKey: ['rewards', 'user', userId],
    queryFn: () => api.getUserRewards(userId!),
    enabled: !!userId,
    ...fresh,
  })
}

export function useRewardDisplay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isDisplayed }: { id: number; isDisplayed: boolean }) =>
      api.setRewardDisplayed(id, isDisplayed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rewards'] }),
    onError: () => qc.invalidateQueries({ queryKey: ['rewards'] }),
  })
}

export function useRedeemReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.redeemReward(id),
    onSuccess: (data) => {
      // 1. Immediately update user points in ['me'] cache without refetching GET /me
      qc.setQueryData<MeDto | null>(['me'], (old) => {
        if (!old) return old
        return { ...old, totalPoints: data.totalPoints }
      })
      // 2. Invalidate and refetch user rewards so newly acquired badge appears
      qc.invalidateQueries({ queryKey: ['rewards', 'mine'] })
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (typeof error.extra?.totalPoints === 'number') {
          // Sync server's actual totalPoints if provided in error metadata
          qc.setQueryData<MeDto | null>(['me'], (old) => {
            if (!old) return old
            return { ...old, totalPoints: error.extra.totalPoints as number }
          })
        }

        if (error.code === 'REWARD_NOT_FOUND') {
          // Catalogue list is stale; reload catalogue
          qc.invalidateQueries({ queryKey: ['rewards', 'catalogue'] })
        } else if (error.code === 'REWARD_ALREADY_OWNED') {
          // User already owns it; reload owned rewards
          qc.invalidateQueries({ queryKey: ['rewards', 'mine'] })
        }
      }
    },
  })
}
