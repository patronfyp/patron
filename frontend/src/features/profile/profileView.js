import { fileUrl } from '@/shared/api/fileUrl'

/** "Abdul Rafay" -> "AR"; one word gives one letter; nothing gives "". */
export function initials(name) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (!words.length) return ''
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (words[0][0] + last).toUpperCase()
}

/** "Lahore University of Management Sciences (LUMS)" -> "LUMS". */
export function shortUniversity(university) {
  return university?.match(/\(([^)]+)\)/)?.[1] ?? university
}

/** 2026 -> "’26", as in Figma's "LUMS ’26 · Verified". */
export function shortYear(year) {
  return year ? `’${String(year).slice(-2)}` : null
}

/** The photo we hold, else the LinkedIn picture, else null (initials are drawn). */
export function profilePhoto(profile) {
  return fileUrl(profile.photo_url) ?? profile.avatar_url
}

/** "Full-Stack AI Engineer · Lahore": the headline, then the city. */
export function headlineLine(profile) {
  return [profile.headline, profile.city].filter(Boolean).join(' · ')
}

/** The URL when it is a plain web link, else null: it ends up in an href. */
export function safeWebUrl(url) {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : null
  } catch {
    return null
  }
}
