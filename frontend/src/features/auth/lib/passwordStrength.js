// The strength bar on Create account (Figma 64:185). Guidance only - the
// backend's 8-72 rule is what blocks.
const LABELS = ['Too short', 'Weak password', 'Good password', 'Strong password']

export const PASSWORD_STRENGTH_SEGMENTS = LABELS.length
export const PASSWORD_STRENGTH_HINT = '12+ chars, a number, a symbol'

/**
 * @param {string} password
 * @returns {{ score: number, label: string }} score is 0 (empty) to 4 (strong)
 */
export function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '' }

  const hasNumber = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  let score = 1
  if (password.length >= 8) score = 2
  if (password.length >= 8 && (hasNumber || hasSymbol)) score = 3
  if (password.length >= 12 && hasNumber && hasSymbol) score = 4

  return { score, label: LABELS[score - 1] }
}
