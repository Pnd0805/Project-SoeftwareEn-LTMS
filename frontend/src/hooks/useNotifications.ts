import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as notificationApi from "../api/notification";

export function useNotifications(userId: number | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => notificationApi.getNotifications(userId as number),
    enabled: userId !== undefined,
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
