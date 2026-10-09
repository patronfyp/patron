import styles from './StepAside.module.css'

/**
 * The info card beside a step ("Why verify?", "Employer Referral").
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.text
 * @param {string} props.tag - the endorsement route this step unlocks
 */
function StepAside({ title, text, tag }) {
  return (
    <div className={styles.aside}>
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
          <path
            d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 12l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{text}</p>
      <span className={styles.tag}>{tag}</span>
    </div>
  )
}

export default StepAside
