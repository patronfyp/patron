import Icon from '@/shared/components/Icon/Icon'

import styles from './StatCard.module.css'

/**
 * One number with a label (Figma Cards / Stat, 7:1038; on the Overview, 10:163).
 * Used on Home and Connections. `value` is null while it loads.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {number | null | undefined} props.value
 * @param {string} props.icon - an imported .svg
 * @param {'accent' | 'warning' | 'neutral'} [props.tone] - the icon tile's colour
 * @param {string} [props.caption] - one line under the number
 */
function StatCard({ label, value, icon, tone = 'neutral', caption }) {
  return (
    <section className={styles.card} aria-label={label}>
      <div className={styles.top}>
        <h3 className={styles.label}>{label}</h3>
        <span className={`${styles.tile} ${styles[tone]}`}>
          <Icon src={icon} />
        </span>
      </div>
      <p className={styles.value}>{value ?? '–'}</p>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </section>
  )
}

export default StatCard
