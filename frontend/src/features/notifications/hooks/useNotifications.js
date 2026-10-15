import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api'

export const notificationKeys = {
  all: ['notifications'],
  list: (params) => ['notifications', 'list', params],
  unreadCount: ['notifications', 'unread-count'],
}

/**
 * The signed-in user's notifications, newest first.
 *
 * @param {{ limit?: number, offset?: number }} [params]
 * @param {{ enabled?: boolean }} [options] - `enabled: false` waits, e.g. until the panel opens
 */
export function useNotifications(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => listNotifications(params),
    enabled,
  })
}

/** The number on the bell. */
export function useUnreadCount() {
  return useQuery({ queryKey: notificationKeys.unreadCount, queryFn: getUnreadCount })
}

// Both writes change the list (read_at) and the bell's number, so they refetch
// everything under `notifications` rather than patching each cached copy.
function useNotificationWrite(mutationFn) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

/** Marks one notification read. Call `mutate(notificationId)`. */
export function useMarkRead() {
  return useNotificationWrite((notificationId) => markNotificationRead(notificationId))
}

export function useMarkAllRead() {
  return useNotificationWrite(() => markAllNotificationsRead())
}
