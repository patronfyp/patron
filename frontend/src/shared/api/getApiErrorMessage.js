/**
 * The message to show for a failed API call. Our own errors carry a plain
 * `detail` string; a 422 from Pydantic carries an array of {msg} - STANDARDS.md
 * §4.7 says show the backend's reason, so handle both.
 *
 * @param {unknown} error
 * @param {string} fallback - shown when the response has no usable detail
 */
export function getApiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return fallback
}
