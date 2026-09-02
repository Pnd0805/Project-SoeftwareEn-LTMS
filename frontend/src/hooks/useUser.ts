/**
 * src/hooks/useUser.ts — U03, U04, U06
 * User queries stay separate from auth: auth owns the current user, while this
 * hook owns public profiles, stats, and authenticated user search.
 */
import { useQuery } from "@tanstack/react-query";
import * as userApi from "../api/user";

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
