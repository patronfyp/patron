import Icon from '@/shared/components/Icon/Icon'

import styles from './StepAside.module.css'

/**
 * The info card beside a step ("Why a code?", "What referrers see"), as on
 * the Figma onboarding frames' Aside.
 *
 * @param {object} props
 * @param {string} props.icon - an imported .svg, drawn in the tile at the top
 * @param {'accent' | 'alum' | 'emp' | 'ai'} [props.tone] - the tile's colour
 *   family: green, or the trust tier / AI colour the step is about
 * @param {string} props.title
 * @param {string} props.text
 * @param {import('react').ReactNode} [props.children] - a chip or checklist under the text
 */
function StepAside({ icon, tone = 'accent', title, text, children }) {
  return (
    <div className={styles.aside}>
      <span className={`${styles.iconTile} ${styles[tone]}`}>
        <Icon src={icon} size={20} />
      </span>
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{text}</p>
      {children}
    </div>
  )
}

/** The small accent chip under an aside's text, e.g. "Takes 30 seconds". */
export function AsideChip({ icon, children }) {
  return (
    <span className={styles.chip}>
      <Icon src={icon} size={12} />
      {children}
    </span>
  )
}

/**
 * A trust-tier badge, e.g. "Verified Alumni" in plum (Figma Trust/alum).
 *
 * @param {object} props
 * @param {'alum' | 'emp'} props.tier
 * @param {string} props.icon
 */
export function TrustBadge({ tier, icon, children }) {
  return (
    <span className={`${styles.trust} ${styles[`trust-${tier}`]}`}>
      <Icon src={icon} size={12} />
      {children}
    </span>
  )
}

/**
 * A ticked list - each item shows a filled tick when `done`, an empty dot
 * when not, so the card reflects what the user has really filled in.
 *
 * @param {object} props
 * @param {{ label: string, done: boolean }[]} props.items
 * @param {string} props.checkIcon
 */
export function AsideChecklist({ items, checkIcon }) {
  return (
    <ul className={styles.checklist}>
      {items.map((item) => (
        <li key={item.label} className={styles.checkItem}>
          <span className={`${styles.checkDot} ${item.done ? styles.checkDone : ''}`}>
            {item.done ? <Icon src={checkIcon} size={11} /> : null}
          </span>
          {item.label}
          <span className={styles.srOnly}>{item.done ? ' (done)' : ' (not yet)'}</span>
        </li>
      ))}
    </ul>
  )
}

export default StepAside
