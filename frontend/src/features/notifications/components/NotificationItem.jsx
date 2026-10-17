import bellIcon from '@/assets/icons/bell-17.svg'
import dotIcon from '@/assets/icons/dot-8.svg'
import Icon from '@/shared/components/Icon/Icon'

import { formatNotificationTime } from '../formatNotificationTime'
import { getTypeMeta } from '../notificationMeta'

import styles from './NotificationItem.module.css'

/**
 * One row of the panel (Figma "Activity", 14:925): a coloured icon tile, the
 * message, how long ago, and a dot while it is unread.
 *
 * @param {object} props
 * @param {import('../api/notifications.api').Notification} props.notification
 * @param {(notification: import('../api/notifications.api').Notification) => void} props.onSelect
 */
function NotificationItem({ notification, onSelect }) {
  const { icon, tone } = getTypeMeta(notification.type)
  const isUnread = notification.read_at === null

  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} onClick={() => onSelect(notification)}>
        <span className={`${styles.tile} ${styles[tone]}`}>
          {icon ? <Icon src={icon} size={15} /> : <Icon src={bellIcon} size={17} />}
        </span>
        <span className={styles.content}>
          <span className={styles.message}>
            <span className={styles.title}>{notification.title}</span>
            {notification.body ? ` ${notification.body}` : null}
          </span>
          <span className={styles.time}>{formatNotificationTime(notification.created_at)}</span>
        </span>
        {isUnread ? (
          <>
            <Icon src={dotIcon} size={8} className={styles.dot} />
            <span className={styles.visuallyHidden}>Unread</span>
          </>
        ) : null}
      </button>
    </li>
  )
}

export default NotificationItem
