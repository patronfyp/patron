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
 * GET /api/v1/auth/me - the signed-in user, identified by the access token.
 * The Authorization header is set explicitly here because the shared client
 * doesn't attach it automatically yet - that lands in #20.
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

/** POST /api/v1/auth/role - the one field a LinkedIn sign-up starts without (#25). */
export async function setRole(role) {
  const response = await api.post('/api/v1/auth/role', { role })
  return response.data
}
