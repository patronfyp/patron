import { API_BASE_URL } from '@/config/env'
import { api } from '@/shared/api/client'

/**
 * @typedef {object} Cv
 * @property {string} filename
 * @property {number} size_bytes
 * @property {string} uploaded_at
 */

/**
 * @typedef {object} Profile
 * @property {string | null} headline
 * @property {string | null} city
 * @property {string | null} phone - "+923001234567"
 * @property {string | null} linkedin_url
 * @property {string | null} bio
 * @property {string | null} photo_url - an API path; pass it through `fileUrl`
 * @property {string | null} university
 * @property {string | null} degree
 * @property {number | null} graduation_year
 * @property {string | null} employer_name
 * @property {Cv | null} cv
 * @property {string[]} skills
 * @property {string | null} primary_role
 * @property {string[]} desired_roles
 * @property {string | null} work_mode
 * @property {string[]} preferred_locations
 * @property {number | null} salary_min
 * @property {number | null} salary_max
 * @property {string | null} available_from - "YYYY-MM-01"
 * @property {boolean} open_to_referrers
 * @property {number} onboarding_step - 1..7, the step the wizard resumes at
 * @property {boolean} onboarding_completed - true once "Finish setup" was pressed
 */

/** A file path the API returned (e.g. `photo_url`) as a full URL. */
export function fileUrl(path) {
  return path ? `${API_BASE_URL}${path}` : null
}

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

/** POST /api/v1/profile/me/onboarding/complete - "Finish setup", from the last step only. */
export async function completeOnboarding() {
  const response = await api.post('/api/v1/profile/me/onboarding/complete')
  return response.data
}

function asForm(file) {
  const form = new FormData()
  form.append('file', file)
  return form
}

// Let the browser set the multipart boundary - the client's JSON default
// would otherwise be sent with the file.
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } }

/** PUT /api/v1/profile/me/photo - a JPG or PNG up to 5 MB. Returns the profile. */
export async function uploadPhoto(file) {
  const response = await api.put('/api/v1/profile/me/photo', asForm(file), MULTIPART)
  return response.data
}

/** DELETE /api/v1/profile/me/photo. Returns the profile. */
export async function removePhoto() {
  const response = await api.delete('/api/v1/profile/me/photo')
  return response.data
}

/** PUT /api/v1/profile/me/cv - a PDF or DOCX up to 5 MB. Returns the profile. */
export async function uploadCv(file) {
  const response = await api.put('/api/v1/profile/me/cv', asForm(file), MULTIPART)
  return response.data
}

/** DELETE /api/v1/profile/me/cv. Returns the profile. */
export async function removeCv() {
  const response = await api.delete('/api/v1/profile/me/cv')
  return response.data
}
