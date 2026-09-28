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
