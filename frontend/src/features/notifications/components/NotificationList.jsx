import { Button, Skeleton } from 'antd'

import NotificationItem from './NotificationItem'
import styles from './NotificationList.module.css'

const SKELETON_ROWS = 3

/**
 * The panel body: the rows, or - STANDARDS.md §4.6 - the loading, error or
 * empty state in their place. The region is announced as it changes.
 *
 * @param {object} props
 * @param {boolean} props.isPending
 * @param {boolean} props.isError
 * @param {() => void} props.onRetry
 * @param {import('../api/notifications.api').Notification[]} props.items - already filtered by tab
 * @param {string} props.emptyMessage
 * @param {(notification: import('../api/notifications.api').Notification) => void} props.onSelect
 */
function NotificationList({ isPending, isError, onRetry, items, emptyMessage, onSelect }) {
  if (isPending) {
    return (
      <div className={styles.region} aria-busy="true" aria-live="polite">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          // The same 32px round tile and 12px padding as a real row, so the
          // list does not jump when the rows arrive.
          <div key={index} className={styles.skeletonRow}>
            <Skeleton
              active
              avatar={{ size: 32, shape: 'circle' }}
              title={false}
              paragraph={{ rows: 1 }}
            />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className={styles.state} role="alert">
        <p className={styles.message}>
          Could not load your notifications. Check your connection and try again.
        </p>
        <Button size="small" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={styles.state} aria-live="polite">
        <p className={styles.message}>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {items.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onSelect={onSelect} />
      ))}
    </ul>
  )
}

export default NotificationList
