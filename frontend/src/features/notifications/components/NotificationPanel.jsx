import styles from './NotificationPanel.module.css'

/**
 * The dropdown under the bell (Figma "Notifications Panel", 14:968): a 420px
 * card with a header. The list, tabs and "Mark all read" are added next.
 */
function NotificationPanel() {
  return (
    <section className={styles.panel} role="dialog" aria-label="Notifications">
      <header className={styles.header}>
        <h2 className={styles.title}>Notifications</h2>
      </header>
    </section>
  )
}

export default NotificationPanel
