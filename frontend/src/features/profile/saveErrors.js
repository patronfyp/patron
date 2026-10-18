// PATCH /profile/me takes the salary as two numbers, the form shows one
// "salary_range" field.
const FORM_FIELD = { salary_min: 'salary_range', salary_max: 'salary_range' }

/**
 * A 422 from PATCH /profile/me as antd form errors, so each message shows
 * under its own field. Pydantic reports `{ loc: ["body", "headline"], msg }`.
 *
 * @param {unknown} error
 * @returns {{ name: string, errors: string[] }[]}
 */
export function fieldErrorsFrom(error) {
  const detail = error?.response?.data?.detail
  if (!Array.isArray(detail)) return []

  return detail
    .filter((item) => Array.isArray(item.loc) && item.loc.length > 1 && item.msg)
    .map((item) => {
      const field = String(item.loc[item.loc.length - 1])
      return { name: FORM_FIELD[field] ?? field, errors: [item.msg] }
    })
}
