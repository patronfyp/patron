import { api } from '@/shared/api/client'

/**
 * @typedef {object} Profile
 * @property {string | null} university
 * @property {string | null} degree
 * @property {number | null} graduation_year
 * @property {string | null} employer_name
 * @property {number} onboarding_step - 1..7, the step the wizard resumes at
 */

/** GET /api/v1/profile/me - the signed-in user's profile; created empty on first read. */
export async function getProfile() {
  const response = await api.get('/api/v1/profile/me')
  return response.data
}

/**
 * PATCH /api/v1/profile/me - only the fields sent are changed. The backend
 * refuses an `onboarding_step` more than one ahead of the saved one.
 *
 * @param {Partial<Profile>} changes
 */
export async function updateProfile(changes) {
  const response = await api.patch('/api/v1/profile/me', changes)
  return response.data
}
