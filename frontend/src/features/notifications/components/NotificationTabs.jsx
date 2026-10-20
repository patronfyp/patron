import { TABS } from '../lib/notificationMeta'

import styles from './NotificationTabs.module.css'

/**
 * The tabs under the panel header (Figma 14:914): All, Referrals,
 * Verification, each with the number of unread notifications in it.
 *
 * @param {object} props
 * @param {string} props.activeKey - a `TABS` key
 * @param {Record<string, number>} props.counts - unread count by tab key
 * @param {(key: string) => void} props.onChange
 */
function NotificationTabs({ activeKey, counts, onChange }) {
  return (
    <div className={styles.tabs} role="group" aria-label="Filter notifications">
      {TABS.map((tab) => {
        const isActive = tab.key === activeKey
        const count = counts[tab.key] ?? 0

        return (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {count > 0 ? (
              <span className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}>
                <span className={styles.visuallyHidden}>, </span>
                {count}
                <span className={styles.visuallyHidden}> unread</span>
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export default NotificationTabs
