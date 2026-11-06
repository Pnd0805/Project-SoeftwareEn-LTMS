import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as notificationApi from "../api/notification";
import { retryPolicy } from "../api/client";

export function useNotifications(userId: number | undefined, enabled = true, page = 1, unread = false) {
  return useQuery({
    queryKey: ["notifications", userId, page, unread],
    queryFn: () => notificationApi.getNotifications(userId as number, page, unread),
    enabled: enabled && userId !== undefined,
    retry: retryPolicy,
  });
}

export function useMarkNotificationRead(userId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) => notificationApi.markNotificationRead(userId as number, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
}

export function useMarkNotificationsRead(userId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markNotificationsRead(userId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
}
