// Same rule as the backend (profiles/schemas.py), so a bad LinkedIn URL is
// caught before Continue - the backend still has the final say.
export const LINKEDIN_PATTERN =
  /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]{3,100}\/?$/i

// "250,000", "250000 - 350000", "250,000 – 350,000" (an en dash, as the
// design writes it).
export const SALARY_RANGE_PATTERN = /^\s*[\d,]+\s*(?:[-–]\s*[\d,]+\s*)?$/

/** "250,000 – 350,000" -> { salary_min: 250000, salary_max: 350000 }; blank -> nulls. */
export function parseSalaryRange(text) {
  const numbers = (text ?? '')
    .split(/[-–]/)
    .map((part) => Number(part.replace(/[^\d]/g, '')))
    .filter((number) => Number.isFinite(number) && number > 0)
  if (numbers.length === 0) return { salary_min: null, salary_max: null }
  const [low, high = low] = numbers
  return { salary_min: Math.min(low, high), salary_max: Math.max(low, high) }
}

/** The inverse of parseSalaryRange, for showing a saved range. */
export function formatSalaryRange(min, max) {
  const hasMin = min !== null && min !== undefined
  const hasMax = max !== null && max !== undefined
  if (!hasMin && !hasMax) return ''
  const format = (number) => number.toLocaleString('en-US')
  if (!hasMin || !hasMax || min === max) return format(hasMin ? min : max)
  return `${format(min)} – ${format(max)}`
}
