import { brand } from '@/config/theme'
import { fileUrl } from '@/shared/api/fileUrl'

import { initialsOf } from './initials'
import styles from './PersonAvatar.module.css'

/** The same gradient for the same person every time, picked from their id. */
function gradientFor(id) {
  const palette = brand.avatarPalette
  let hash = 0
  for (const char of String(id ?? '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}

/**
 * Someone else's avatar (Figma Connection Card, 14:473): their uploaded
 * photo, else their LinkedIn picture, else initials on a gradient.
 *
 * @param {object} props
 * @param {{ user_id: string, full_name: string, photo_url: string | null, avatar_url: string | null }} props.person
 */
function PersonAvatar({ person }) {
  const src = fileUrl(person.photo_url) ?? person.avatar_url
  return (
    <span
      className={styles.avatar}
      style={src ? undefined : { background: gradientFor(person.user_id) }}
      aria-hidden="true"
    >
      {src ? <img className={styles.photo} src={src} alt="" /> : initialsOf(person.full_name)}
    </span>
  )
}

export default PersonAvatar
