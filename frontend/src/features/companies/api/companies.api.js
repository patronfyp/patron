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

/**
 * The backend's CompanyInviteRead.
 *
 * @typedef {object} CompanyInvite
 * @property {string} id
 * @property {string} email
 * @property {'recruiter' | 'hiring_manager' | 'interviewer'} role
 * @property {'pending' | 'accepted' | 'expired'} status
 */

/** GET /api/v1/companies/me/invites - newest first, capped at 200. */
export async function getCompanyInvites() {
  const response = await api.get('/api/v1/companies/me/invites')
  return response.data
}

/**
 * POST /api/v1/companies/me/invites (#104) - emails a one-time sign-up link.
 * The email must be on the company's domain.
 */
export async function createCompanyInvite({ email, role }) {
  const response = await api.post('/api/v1/companies/me/invites', { email, role })
  return response.data
}

/** DELETE /api/v1/companies/me/invites/{id} - cancels a pending invite. */
export async function deleteCompanyInvite(id) {
  await api.delete(`/api/v1/companies/me/invites/${id}`)
}

/**
 * POST /api/v1/companies/invites/preview (#104) - no auth needed, the token
 * alone identifies the invite. 404 for an unknown, expired or revoked token.
 */
export async function previewCompanyInvite(token) {
  const response = await api.post('/api/v1/companies/invites/preview', { token })
  return response.data
}

/**
 * POST /api/v1/companies/invites/accept (#104) - the signed-in user joins
 * the company with the invited role. Call right after sign-up and login.
 */
export async function acceptCompanyInvite(token) {
  const response = await api.post('/api/v1/companies/invites/accept', { token })
  return response.data
}
