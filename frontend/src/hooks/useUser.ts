/**
 * src/hooks/useUser.ts — U03, U04, U06
 * User queries stay separate from auth: auth owns the current user, while this
 * hook owns public profiles, stats, and authenticated user search.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as userApi from "../api/user";
import * as engagementApi from "../api/engagement";

export function usePublicUser(userId: number | undefined) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => userApi.getPublicUser(userId as number),
    enabled: userId !== undefined,
  });
}

export function useUserStats(userId: number | undefined) {
  return useQuery({
    queryKey: ["users", userId, "stats"],
    queryFn: () => userApi.getUserStats(userId as number),
    enabled: userId !== undefined,
  });
}

export function useSearchUsers(query: string, enabled = true) {
  const normalizedQuery = query.trim();
  return useQuery({
    queryKey: ["users", "search", normalizedQuery],
    queryFn: () => userApi.searchUsers(normalizedQuery),
    enabled: enabled && normalizedQuery.length >= 3,
  });
}

export function useFollows(userId: number | undefined) {
  return useQuery({
    queryKey: ["follows", userId],
    queryFn: () => engagementApi.getFollows(userId as number),
    enabled: userId !== undefined,
  });
}

export function useFollow(
  userId: number | undefined,
  target: string,
) {
  const queryClient = useQueryClient()
  const queryKey = ["follows", userId]

  const follows = useFollows(userId)

  const toggle = useMutation({
    mutationFn: async () => {
      const isFollowing = follows.data?.targets.includes(target) ?? false

      return isFollowing
        ? engagementApi.unfollow(userId as number, target)
        : engagementApi.follow(userId as number, target)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    isFollowing: follows.data?.targets.includes(target) ?? false,
    isLoading: follows.isLoading,
    toggle,
  }
}

export function useMvpVotes(
  tournamentId: string | undefined,
  userId: string | undefined,
) {
  const queryClient = useQueryClient()
  const queryKey = ["votes", "mvp", tournamentId, userId]
  const votes = useQuery({
    queryKey,
    queryFn: () => engagementApi.getMvpVotes(tournamentId as string, userId as string),
    enabled: tournamentId !== undefined && userId !== undefined,
  })

  const cast = useMutation({
    mutationFn: (playerId: string) => engagementApi.castMvpVote(
      tournamentId as string,
      userId as string,
      playerId,
    ),
    onSuccess: data => {
      queryClient.setQueryData(queryKey, data)
    },
  })

  return { ...votes, cast }
}

export function useComments(matchId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["comments", matchId]
  const comments = useQuery({
    queryKey,
    queryFn: () => engagementApi.getComments(matchId as string),
    enabled: matchId !== undefined,
  })

  const post = useMutation({
    mutationFn: (input: { userId: string; userName: string; text: string }) =>
      engagementApi.postComment(matchId as string, input.userId, input.userName, input.text),
    onSuccess: data => queryClient.setQueryData(queryKey, data),
  })

  const remove = useMutation({
    mutationFn: (commentId: string) => engagementApi.removeComment(matchId as string, commentId),
    onSuccess: data => queryClient.setQueryData(queryKey, data),
  })

  return { ...comments, post, remove }
}

export function usePicks(
  matchId: string | undefined,
  userId: string | undefined,
) {
  const queryClient = useQueryClient()
  const queryKey = ["picks", matchId, userId]
  const picks = useQuery({
    queryKey,
    queryFn: () => engagementApi.getPicks(matchId as string, userId as string),
    enabled: matchId !== undefined && userId !== undefined,
  })

  const place = useMutation({
    mutationFn: (teamId: string) => engagementApi.placePick(
      matchId as string,
      userId as string,
      teamId,
    ),
    onSuccess: data => queryClient.setQueryData(queryKey, data),
  })

  return { ...picks, place }
}