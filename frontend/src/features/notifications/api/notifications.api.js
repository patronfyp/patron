import { api } from '@/shared/api/client'

/**
 * @typedef {object} Notification
 * @property {string} id
 * @property {string} type - what happened, e.g. "email_verified"; unknown types must still render
 * @property {string} title
 * @property {string | null} body
 * @property {string | null} link - an app path like "/onboarding", never a full URL
 * @property {string | null} read_at - null while unread
 * @property {string} created_at - ISO 8601
 */

/**
 * @typedef {object} NotificationPage
 * @property {Notification[]} items - newest first
 * @property {number} total - every notification the user has, read or not
 * @property {number} limit
 * @property {number} offset
 */

/**
 * GET /api/v1/notifications/me - the signed-in user's notifications, newest
 * first. The backend caps `limit` at 100.
 *
 * @param {{ limit?: number, offset?: number }} [params]
 * @returns {Promise<NotificationPage>}
 */
export async function listNotifications(params = {}) {
  const response = await api.get('/api/v1/notifications/me', { params })
  return response.data
}

/** GET /api/v1/notifications/me/unread-count - the number on the bell. */
export async function getUnreadCount() {
  const response = await api.get('/api/v1/notifications/me/unread-count')
  return response.data.count
}

/**
 * POST /api/v1/notifications/{id}/read. Someone else's notification is a 404,
 * the same as one that does not exist.
 *
 * @param {string} notificationId
 * @returns {Promise<Notification>}
 */
export async function markNotificationRead(notificationId) {
  const response = await api.post(`/api/v1/notifications/${notificationId}/read`)
  return response.data
}

/** POST /api/v1/notifications/me/read-all - answers 204 with no body. */
export async function markAllNotificationsRead() {
  await api.post('/api/v1/notifications/me/read-all')
}
