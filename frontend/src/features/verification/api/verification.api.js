import { api } from '@/shared/api/client'

/**
 * POST /api/v1/verification/email/send - emails a 6-digit code to the sign-up
 * address (`kind: "account"`), a university address (`kind: "university"`)
 * or a work address (`kind: "employer"`). Returns the two numbers the resend
 * countdown is built from, never the code.
 */
export async function sendVerificationCode({ email, kind }) {
  const response = await api.post('/api/v1/verification/email/send', { email, kind })
  return response.data
}

/**
 * POST /api/v1/verification/email/confirm - checks `code` against the latest
 * one sent to `email`. Wrong, expired, already used and locked-after-5-tries
 * all come back as the same 400 on purpose (service.py) - there is nothing to
 * branch on client side beyond "it failed".
 */
export async function confirmVerificationCode({ email, kind, code }) {
  const response = await api.post('/api/v1/verification/email/confirm', { email, kind, code })
  return response.data
}

/**
 * @typedef {object} VerificationStatus
 * @property {string} email - the sign-up address
 * @property {boolean} email_verified
 * @property {{ email: string, verified_at: string } | null} university_email
 * @property {{ email: string, verified_at: string } | null} employer_email
 * @property {{ id: string, kind: string, filename: string, status: string }[]} documents
 */

/** GET /api/v1/verification/me - everything the user has verified so far. */
export async function getVerificationStatus() {
  const response = await api.get('/api/v1/verification/me')
  return response.data
}

/**
 * POST /api/v1/verification/documents - a transcript, degree or employment
 * letter (PDF, JPG or PNG, up to 5 MB), stored as pending review.
 */
export async function uploadVerificationDocument({ kind, file }) {
  const form = new FormData()
  form.append('kind', kind)
  form.append('file', file)
  const response = await api.post('/api/v1/verification/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}
