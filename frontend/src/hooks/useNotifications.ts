import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as notificationApi from "../api/notification";
import { retryPolicy } from "../api/client";

export function useNotifications(userId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => notificationApi.getNotifications(userId as number),
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
