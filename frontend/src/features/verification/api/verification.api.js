import { api } from '@/shared/api/client'

/**
 * POST /api/v1/verification/email/send - emails a 6-digit code to a
 * university (`kind: "university"`) or work (`kind: "employer"`) address.
 * Returns the two numbers the resend countdown is built from, never the code.
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
