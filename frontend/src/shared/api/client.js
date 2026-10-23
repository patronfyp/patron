import axios from 'axios'

import { API_BASE_URL } from '@/config/env'

/**
 * The one axios instance for the backend - never call axios directly.
 */

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  // Cross-origin in dev; needed so the LinkedIn state cookie is stored.
  withCredentials: true,
})

// shared/ can't import features/, so the auth feature plugs its tokens in here.
let authHandlers = { getAccessToken: () => null }

// The refresh currently running, if any. Requests that expire together (a page
// firing five at once) all wait on this one call instead of starting five.
let refreshInFlight = null

function refreshOnce() {
  refreshInFlight ??= authHandlers
    .refresh()
    .catch((refreshError) => {
      // Here rather than per request, so five waiting requests report it once.
      authHandlers.onAuthFailure?.()
      throw refreshError
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

/**
 * @param {object} handlers
 * @param {() => string | null} handlers.getAccessToken - the current access token, if any
 * @param {() => Promise<string>} [handlers.refresh] - gets (and stores) a new
 *   access token; rejects if the session cannot be refreshed
 * @param {() => void} [handlers.onAuthFailure] - called once when a refresh
 *   fails, i.e. the session is over and the user has to log in again
 */
export function configureAuthClient(handlers) {
  authHandlers = handlers
  refreshInFlight = null
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

  // Another request already refreshed - reuse its token.
  let accessToken = authHandlers.getAccessToken()
  if (!accessToken || `Bearer ${accessToken}` === config.headers.Authorization) {
    try {
      accessToken = await refreshOnce()
    } catch {
      throw error
    }
  }

  // Set explicitly: the failed request's config still carries the old token,
  // and the request interceptor leaves an existing Authorization header alone.
  config.headers.Authorization = `Bearer ${accessToken}`
  return api(config)
})
