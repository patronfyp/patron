import axios from 'axios'

/**
 * Single axios instance for every call to the Patron backend.
 *
 * Nothing else in the app should call axios directly - importing this keeps the
 * base URL, timeout and (later) auth headers in one place.
 */

const baseURL = import.meta.env.VITE_API_BASE_URL

if (!baseURL) {
  throw new Error(
    'VITE_API_BASE_URL is not set. Copy frontend/.env.example to frontend/.env.local.',
  )
}

export const api = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})
