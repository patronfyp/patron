import { api } from '@/shared/api/client'

/**
 * A user as lists show them (the backend's PersonSummary).
 *
 * @typedef {object} PersonSummary
 * @property {string} user_id
 * @property {string} full_name
 * @property {string | null} photo_url - our uploaded photo (an API path)
 * @property {string | null} avatar_url - the LinkedIn picture, used when there is no photo
 * @property {string | null} headline
 * @property {string | null} job_title
 * @property {string | null} employer_name
 * @property {string | null} university
 */

/**
 * @typedef {'none' | 'connected' | 'pending_sent' | 'pending_received'} Relationship
 * @typedef {'professional' | 'alumni' | 'both'} ConnectionType
 */

/**
 * GET /api/v1/connections - one page of my connections, newest first.
 *
 * @param {{ q?: string, limit?: number, offset?: number }} [params]
 * @returns {Promise<{ items: { person: PersonSummary, connection_type: ConnectionType, connected_at: string }[], total: number }>}
 */
export async function listConnections(params = {}) {
  const response = await api.get('/api/v1/connections', { params })
  return response.data
}

/**
 * GET /api/v1/connections/requests - pending requests, newest first (at most 100).
 *
 * @param {'received' | 'sent'} direction
 * @returns {Promise<{ id: string, direction: string, person: PersonSummary, created_at: string }[]>}
 */
export async function listRequests(direction) {
  const response = await api.get('/api/v1/connections/requests', { params: { direction } })
  return response.data
}

/** POST /api/v1/connections/requests - ask someone to connect. */
export async function sendRequest(userId) {
  const response = await api.post('/api/v1/connections/requests', { user_id: userId })
  return response.data
}

/** POST /api/v1/connections/requests/{id}/accept */
export async function acceptRequest(requestId) {
  await api.post(`/api/v1/connections/requests/${requestId}/accept`)
}

/** POST /api/v1/connections/requests/{id}/decline - the sender is never told. */
export async function declineRequest(requestId) {
  await api.post(`/api/v1/connections/requests/${requestId}/decline`)
}

/** DELETE /api/v1/connections/requests/{id} - withdraw a request I sent. */
export async function withdrawRequest(requestId) {
  await api.delete(`/api/v1/connections/requests/${requestId}`)
}

/** DELETE /api/v1/connections/{userId} */
export async function removeConnection(userId) {
  await api.delete(`/api/v1/connections/${userId}`)
}

/**
 * GET /api/v1/connections/with/{userId} - where I stand with someone.
 *
 * @returns {Promise<{ user_id: string, status: Relationship, request_id: string | null, connection_type: ConnectionType | null, mutual_count: number, mutual: PersonSummary[] }>}
 */
export async function getRelationship(userId) {
  const response = await api.get(`/api/v1/connections/with/${userId}`)
  return response.data
}
