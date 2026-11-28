import { api } from '@/shared/api/client'

/**
 * A search result (the backend's PersonResult): a person, their verified
 * badges, and where I stand with them.
 *
 * @typedef {import('./connections.api').PersonSummary & {
 *   university_verified: boolean,
 *   employer_verified: boolean,
 *   relationship: import('./connections.api').Relationship,
 *   request_id: string | null,
 * }} PersonResult
 */

/**
 * GET /api/v1/people?q= - at most 20, names starting with `q` first. `q` must
 * be 2-100 characters (a 422 below that).
 *
 * @param {string} q
 * @param {AbortSignal} [signal]
 * @returns {Promise<PersonResult[]>}
 */
export async function searchPeople(q, signal) {
  const response = await api.get('/api/v1/people', { params: { q }, signal })
  return response.data
}
