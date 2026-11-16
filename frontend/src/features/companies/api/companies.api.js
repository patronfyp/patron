import { api } from '@/shared/api/client'

/**
 * The backend's CompanyRead: a company plus the signed-in user's role in it.
 *
 * @typedef {object} Company
 * @property {string} id
 * @property {string} name
 * @property {string} domain - e.g. "garner.com"
 * @property {'1-50' | '51-200' | '201-1000' | '1000+'} size
 * @property {string} industry - one of INDUSTRIES' values
 * @property {string} headquarters
 * @property {string | null} logo_url - an API path; pass it through `fileUrl`
 * @property {boolean} employees_can_refer
 * @property {string} verified_at
 * @property {'owner' | 'recruiter' | 'hiring_manager' | 'interviewer'} my_role
 */

/** GET /api/v1/companies/me. 404 when the user has no company yet. */
export async function getMyCompany() {
  const response = await api.get('/api/v1/companies/me')
  return response.data
}

/**
 * POST /api/v1/companies/me - creates the company (201) or joins it if its
 * domain is already on PATRON (200). Needs a verified work email on the domain.
 */
export async function createOrJoinCompany(company) {
  const response = await api.post('/api/v1/companies/me', company)
  return response.data
}

/** PATCH /api/v1/companies/me - only the fields sent change. */
export async function updateCompany(changes) {
  const response = await api.patch('/api/v1/companies/me', changes)
  return response.data
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } }

/** PUT /api/v1/companies/me/logo - a PNG or JPG up to 5 MB. */
export async function uploadCompanyLogo(file) {
  const form = new FormData()
  form.append('file', file)
  const response = await api.put('/api/v1/companies/me/logo', form, MULTIPART)
  return response.data
}

/** DELETE /api/v1/companies/me/logo. */
export async function removeCompanyLogo() {
  const response = await api.delete('/api/v1/companies/me/logo')
  return response.data
}
