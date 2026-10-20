const MINUTE = 60_000
const HOUR = 60 * MINUTE

// Within this many hours a time reads "3 h ago"; older the same day it reads
// "Today". The Figma panel shows "1 h ago" and then "Today".
const RECENT_HOURS = 6

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/**
 * A notification's age the way the Figma panel writes it: "2 min ago",
 * "1 h ago", "Today", "Yesterday", then "3 days ago" and a date.
 *
 * @param {string} isoTime - ISO 8601, e.g. a notification's `created_at`
 * @param {Date} [now] - injectable so tests do not depend on the clock
 */
export function formatNotificationTime(isoTime, now = new Date()) {
  const time = new Date(isoTime)
  const age = now - time

  if (age < MINUTE) return 'Just now'
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min ago`

  const hours = Math.floor(age / HOUR)
  const daysAgo = Math.round((startOfDay(now) - startOfDay(time)) / (24 * HOUR))

  if (daysAgo === 0) return hours < RECENT_HOURS ? `${hours} h ago` : 'Today'
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo < 7) return `${daysAgo} days ago`
  return time.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
