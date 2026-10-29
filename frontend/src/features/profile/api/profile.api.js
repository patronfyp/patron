import { api } from '@/shared/api/client'

/**
 * What any signed-in user may see of another - never phone, CV or salary.
 *
 * @typedef {object} PublicProfile
 * @property {string} user_id
 * @property {string} full_name
 * @property {string[]} roles - "candidate", "referrer", "recruiter", ...
 * @property {string | null} photo_url - our uploaded photo, an API path: pass it through `fileUrl`
 * @property {string | null} avatar_url - the LinkedIn picture, a full URL; used when there is no photo_url
 * @property {string | null} headline
 * @property {string | null} city
 * @property {string | null} bio
 * @property {string | null} linkedin_url
 * @property {string | null} university
 * @property {string | null} degree
 * @property {number | null} graduation_year
 * @property {string | null} employer_name
 * @property {string | null} job_title
 * @property {string[]} skills
 * @property {string | null} primary_role
 * @property {boolean} university_verified - the Verified Alumni badge
 * @property {boolean} employer_verified - the Verified Employee badge
 */

/**
 * GET /api/v1/profile/{user_id}. A 404 means no such user, or a deactivated
 * account; a user id that is not a UUID is a 422.
 *
 * @param {string} userId
 * @returns {Promise<PublicProfile>}
 */
export async function getPublicProfile(userId) {
  const response = await api.get(`/api/v1/profile/${userId}`)
  return response.data
}
