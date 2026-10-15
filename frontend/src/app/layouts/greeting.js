/**
 * "Good morning" / "Good afternoon" / "Good evening" for the hour of `date`.
 * Figma only draws the morning one (Top Navigation, 7:648).
 *
 * @param {Date} [date]
 */
export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "Abdul Rafay" -> "Abdul". An empty or missing name gives "". */
export function getFirstName(fullName) {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * The letters in the avatar: the first letter of the first and last word,
 * "Abdul Rafay" -> "AR". One word gives one letter; no name gives "".
 */
export function getInitials(fullName) {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = Array.from(words[0])[0]
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : ''
  return (first + last).toUpperCase()
}
