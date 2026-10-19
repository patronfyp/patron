import Icon from '@/shared/components/Icon/Icon'

import styles from './ProfileChip.module.css'

/**
 * A small status or trust label (Figma Chip/* and Trust/* on Candidate ·
 * Profile, 14:2).
 *
 * @param {object} props
 * @param {'success' | 'warning' | 'accent' | 'neutral' | 'alum' | 'emp'} props.tone
 * @param {string} [props.icon] - an imported .svg, drawn before the text
 * @param {number} [props.iconSize] - defaults to 12
 * @param {boolean} [props.large] - the 26px chips of the identity card (22px otherwise)
 * @param {boolean} [props.trust] - the bordered, semibold Trust/* badge
 */
function ProfileChip({ tone, icon, iconSize = 12, large = false, trust = false, children }) {
  const classes = [styles.chip, styles[tone], large && styles.large, trust && styles.trust]
  return (
    <span className={classes.filter(Boolean).join(' ')}>
      {icon ? <Icon src={icon} size={iconSize} className={styles.icon} /> : null}
      {children}
    </span>
  )
}

export default ProfileChip
