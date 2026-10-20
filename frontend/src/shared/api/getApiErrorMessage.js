/**
 * The backend's reason for a failed call (a `detail` string or Pydantic's {msg}).
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
