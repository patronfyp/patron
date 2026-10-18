import { API_BASE_URL } from '@/config/env'

/**
 * A file path the API returned (e.g. a profile's `photo_url`) as a full URL,
 * or null when there is no file.
 *
 * @param {string | null | undefined} path - an API path like "/api/v1/profile/..."
 */
export function fileUrl(path) {
  return path ? `${API_BASE_URL}${path}` : null
}
