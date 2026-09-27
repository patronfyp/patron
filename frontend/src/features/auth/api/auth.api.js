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
