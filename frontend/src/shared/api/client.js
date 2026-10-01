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
  // The frontend and backend are different origins in dev (5173 vs 8000).
  // Without this, the browser silently drops the Set-Cookie response from
  // GET /auth/linkedin/authorize (#25) - the li_oauth_state cookie never
  // gets stored, so /callback always sees it missing. The backend already
  // allows this (CORSMiddleware's allow_credentials=True in main.py).
  withCredentials: true,
})

// shared/ may not import from features/ (STANDARDS.md §2.6), so the auth
// feature hands its token access to this client instead of the client
// reaching into the auth store.
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

  // If the store already holds a different token than this request was sent
  // with, another request refreshed while this one was in flight - use that
  // token rather than refreshing a second time.
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
