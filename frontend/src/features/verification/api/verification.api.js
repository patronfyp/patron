import { api } from '@/shared/api/client'

/**
 * POST /api/v1/verification/email/send. Returns the resend countdown, never the code.
 */
export async function sendVerificationCode({ email, kind }) {
  const response = await api.post('/api/v1/verification/email/send', { email, kind })
  return response.data
}

/**
 * POST /api/v1/verification/email/confirm. Every failure is the same 400.
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
