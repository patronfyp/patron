import axios from 'axios'

import { API_BASE_URL } from '../../config/env'

/**
 * Single axios instance for every call to the Patron backend.
 *
 * Nothing else in the app should call axios directly - importing this keeps the
 * base URL, timeout and (later) auth headers in one place.
 */

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})
