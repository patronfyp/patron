import styles from './ProfileCard.module.css'

/**
 * A titled white card (Figma Card on Candidate · Profile, 14:2).
 *
 * @param {object} props
 * @param {string} props.title
 * @param {'main' | 'side'} [props.column] - the wide left column (radius 14, hairline shadow) or the 340px right one (radius 16)
 * @param {boolean} [props.tight] - no gap under the title: Experience, whose rows pad themselves
 */
function ProfileCard({ title, column = 'main', tight = false, children }) {
  return (
    <section className={`${styles.card} ${styles[column]} ${tight ? styles.tight : ''}`}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  )
}

export default ProfileCard
