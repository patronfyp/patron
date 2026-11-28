import { api } from '@/shared/api/client'

/**
 * The backend's JobRead (#106/#109) - a draft job on the signed-in user's company.
 *
 * @typedef {object} Job
 * @property {string} id
 * @property {string} title
 * @property {string} location
 * @property {'on_site' | 'hybrid' | 'remote'} work_mode
 * @property {number | null} salary_min - monthly PKR
 * @property {number | null} salary_max - monthly PKR
 * @property {number} openings - 1-50
 * @property {'draft'} status - the only status for now; posting lands in Sprint 5
 */

/** GET /api/v1/companies/me/jobs - capped at 200, this company's only. */
export async function getJobs() {
  // The list is paged (`{ items, total }`, newest first); onboarding shows
  // the first page, which holds every draft a new company could have.
  const response = await api.get('/api/v1/companies/me/jobs', { params: { limit: 100 } })
  return response.data.items
}

/** POST /api/v1/companies/me/jobs - always created as a draft. */
export async function createJob(job) {
  const response = await api.post('/api/v1/companies/me/jobs', job)
  return response.data
}

/** PATCH /api/v1/companies/me/jobs/{id} - only the fields sent change. */
export async function updateJob({ id, ...changes }) {
  const response = await api.patch(`/api/v1/companies/me/jobs/${id}`, changes)
  return response.data
}

/** DELETE /api/v1/companies/me/jobs/{id}. */
export async function deleteJob(id) {
  await api.delete(`/api/v1/companies/me/jobs/${id}`)
}
