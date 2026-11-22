import { Link } from 'react-router-dom'

import bellIcon from '@/assets/icons/bell-16.svg'
import {
  formatNotificationTime,
  getTypeMeta,
  isAppPath,
  useNotifications,
} from '@/features/notifications'
import Icon from '@/shared/components/Icon/Icon'

import styles from './RecentActivity.module.css'

const SHOWN = 5

/** One row: the notification's icon, title and time; a link when it has one. */
function ActivityRow({ notification }) {
  const meta = getTypeMeta(notification.type)
  const content = (
    <>
      <span className={`${styles.tile} ${styles[meta.tone]}`}>
        <Icon src={meta.icon ?? bellIcon} size={15} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{notification.title}</span>
        <time className={styles.time} dateTime={notification.created_at}>
          {formatNotificationTime(notification.created_at)}
        </time>
      </span>
    </>
  )

  return (
    <li className={styles.row}>
      {isAppPath(notification.link) ? (
        <Link to={notification.link} className={styles.link}>
          {content}
        </Link>
      ) : (
        <div className={styles.link}>{content}</div>
      )}
    </li>
  )
}

/** "Recent activity" (Figma 10:414): the user's latest notifications. */
function RecentActivity() {
  const { data, isPending, isError } = useNotifications({ limit: SHOWN })

  let body
  if (isPending) {
    body = <p className={styles.empty}>Loading…</p>
  } else if (isError) {
    body = <p className={styles.empty}>Couldn’t load your activity.</p>
  } else if (data.items.length === 0) {
    body = (
      <p className={styles.empty}>Nothing yet. Requests, verifications and replies show up here.</p>
    )
  } else {
    body = (
      <ul className={styles.list}>
        {data.items.map((notification) => (
          <ActivityRow key={notification.id} notification={notification} />
        ))}
      </ul>
    )
  }

  return (
    <section className={styles.card} aria-labelledby="recent-activity-title">
      <h2 id="recent-activity-title" className={styles.heading}>
        Recent activity
      </h2>
      {body}
    </section>
  )
}

export default RecentActivity
