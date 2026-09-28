import axios from 'axios'

import { API_BASE_URL } from '../../config/env'

/**
 * Single axios instance for every call to the Patron backend.
 *
 * Nothing else in the app should call axios directly - importing this keeps the
 * base URL, timeout and auth headers in one place.
 */

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// shared/ may not import from features/ (STANDARDS.md §2.6), so the auth
// feature hands its token access to this client instead of the client
// reaching into the auth store.
let authHandlers = { getAccessToken: () => null }

/**
 * @param {object} handlers
 * @param {() => string | null} handlers.getAccessToken - the current access token, if any
 * @param {() => Promise<string>} [handlers.refresh] - gets (and stores) a new
 *   access token; rejects if the session cannot be refreshed
 */
export function configureAuthClient(handlers) {
  authHandlers = handlers
}

api.interceptors.request.use((config) => {
  const accessToken = authHandlers.getAccessToken()

  // A caller that set its own Authorization header knows better - leave it.
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

// A 401 from these is an answer, not an expired session: wrong credentials, or
// a refresh token that no longer works. Refreshing on them would loop.
const NO_REFRESH_PATHS = /\/auth\/(login|register|refresh)$/

api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error

  const shouldRefresh =
    response?.status === 401 &&
    authHandlers.refresh &&
    config &&
    !config._retried &&
    !NO_REFRESH_PATHS.test(config.url ?? '')

  if (!shouldRefresh) throw error

  // One retry per request: a second 401 means the new token was refused too.
  config._retried = true

  let accessToken
  try {
    accessToken = await authHandlers.refresh()
  } catch {
    throw error
  }

  // Set explicitly: the failed request's config still carries the old token,
  // and the request interceptor leaves an existing Authorization header alone.
  config.headers.Authorization = `Bearer ${accessToken}`
  return api(config)
})
