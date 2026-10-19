import { describe, expect, it } from 'vitest'

import { formatNotificationTime } from './formatNotificationTime'

// Local time on purpose: "Today" and "Yesterday" are calendar days in the
// user's own time zone.
const now = new Date(2026, 9, 15, 15, 0, 0)
const at = (...args) => new Date(...args).toISOString()

describe('formatNotificationTime', () => {
  it('says "Just now" under a minute', () => {
    expect(formatNotificationTime(at(2026, 9, 15, 14, 59, 30), now)).toBe('Just now')
  })

  it('counts minutes under an hour', () => {
    expect(formatNotificationTime(at(2026, 9, 15, 14, 58), now)).toBe('2 min ago')
    expect(formatNotificationTime(at(2026, 9, 15, 14, 1), now)).toBe('59 min ago')
  })

  it('counts hours for the first few hours of the same day', () => {
    expect(formatNotificationTime(at(2026, 9, 15, 14, 0), now)).toBe('1 h ago')
    expect(formatNotificationTime(at(2026, 9, 15, 10, 0), now)).toBe('5 h ago')
  })

  it('says "Today" for an earlier hour of the same day', () => {
    expect(formatNotificationTime(at(2026, 9, 15, 8, 0), now)).toBe('Today')
  })

  it('says "Yesterday" for the previous calendar day, even a few hours ago', () => {
    expect(formatNotificationTime(at(2026, 9, 14, 23, 0), new Date(2026, 9, 15, 1, 0))).toBe(
      'Yesterday',
    )
    expect(formatNotificationTime(at(2026, 9, 14, 9, 0), now)).toBe('Yesterday')
  })

  it('counts days within a week', () => {
    expect(formatNotificationTime(at(2026, 9, 12, 9, 0), now)).toBe('3 days ago')
  })

  it('falls back to the date after a week', () => {
    expect(formatNotificationTime(at(2026, 9, 1, 9, 0), now)).toBe('1 Oct')
  })
})
