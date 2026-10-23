import { api } from '@/shared/api/client'

/** POST /api/v1/auth/register - creates the account. Returns the new user, no tokens. */
export async function register({ fullName, email, password, role }) {
  const response = await api.post('/api/v1/auth/register', {
    full_name: fullName,
    email,
    password,
    role,
  })
  return response.data
}

/** POST /api/v1/auth/login - exchanges credentials for an access + refresh token pair. */
export async function login({ email, password }) {
  const response = await api.post('/api/v1/auth/login', { email, password })
  return response.data
}

/** POST /api/v1/auth/refresh - exchanges the refresh token for a new access token. */
export async function refreshAccessToken(refreshToken) {
  const response = await api.post('/api/v1/auth/refresh', { refresh_token: refreshToken })
  return response.data
}

/**
 * GET /api/v1/auth/me. Takes the token explicitly: login calls it before the
 * token is in the store.
 */
export async function getCurrentUser(accessToken) {
  const response = await api.get('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.data
}

/** GET /api/v1/auth/linkedin/authorize - the LinkedIn consent URL (#25). */
export async function linkedinAuthorize() {
  const response = await api.get('/api/v1/auth/linkedin/authorize')
  return response.data
}

/** POST /api/v1/auth/role - adds a role (candidate, referrer or recruiter) to the account. */
export async function setRole(role) {
  const response = await api.post('/api/v1/auth/role', { role })
  return response.data
}

/**
 * POST /api/v1/auth/password-reset/request - always 202.
 */
export async function requestPasswordReset({ email }) {
  const response = await api.post('/api/v1/auth/password-reset/request', { email })
  return response.data
}

/**
 * POST /api/v1/auth/password-reset/confirm. 400 = bad token, 422 = bad password.
 */
export async function confirmPasswordReset({ token, newPassword }) {
  const response = await api.post('/api/v1/auth/password-reset/confirm', {
    token,
    new_password: newPassword,
  })
  return response.data
}

/**
 * POST /api/v1/auth/password/change. Returns new tokens - the old ones stop working.
 */
export async function changePassword({ currentPassword, newPassword }) {
  const response = await api.post('/api/v1/auth/password/change', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return response.data
}
