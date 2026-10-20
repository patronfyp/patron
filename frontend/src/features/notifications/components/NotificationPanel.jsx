import { useState } from 'react'

import { App } from 'antd'
import { useNavigate } from 'react-router-dom'

import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../hooks/useNotifications'
import { filterByTab, isAppPath, TABS } from '../lib/notificationMeta'

import NotificationList from './NotificationList'
import styles from './NotificationPanel.module.css'
import NotificationTabs from './NotificationTabs'

// Figma draws five rows; the backend defaults to 20 and caps at 100. Older
// notifications past the first page are not shown yet.
const PAGE_SIZE = 20

const isUnread = (notification) => notification.read_at === null

/**
 * The dropdown under the bell (Figma 14:968). Choosing a notification marks
 * it read and follows its link.
 *
 * @param {object} props
 * @param {() => void} props.onClose - called after following a link
 */
function NotificationPanel({ onClose }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')

  const list = useNotifications({ limit: PAGE_SIZE })
  const { data: unreadCount = 0 } = useUnreadCount()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const items = list.data?.items ?? []

  // "All" is the true unread total; the others count within the loaded page.
  const counts = Object.fromEntries(
    TABS.map((tab) => [
      tab.key,
      tab.key === 'all' ? unreadCount : filterByTab(items, tab.key).filter(isUnread).length,
    ]),
  )

  const handleSelect = (notification) => {
    if (isUnread(notification)) {
      markRead.mutate(notification.id, {
        onError: (error) =>
          message.error(getApiErrorMessage(error, 'Could not mark it as read. Please try again.')),
      })
    }
    if (isAppPath(notification.link)) {
      navigate(notification.link)
      onClose()
    }
  }

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onError: (error) =>
        message.error(
          getApiErrorMessage(error, 'Could not mark them all as read. Please try again.'),
        ),
    })
  }

  return (
    <section className={styles.panel} role="dialog" aria-label="Notifications">
      <header className={styles.header}>
        <h2 className={styles.title}>Notifications</h2>
        <button
          type="button"
          className={styles.markAll}
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || markAllRead.isPending}
        >
          Mark all read
        </button>
      </header>

      <NotificationTabs activeKey={activeTab} counts={counts} onChange={setActiveTab} />

      <NotificationList
        isPending={list.isPending}
        isError={list.isError}
        onRetry={list.refetch}
        items={filterByTab(items, activeTab)}
        emptyMessage={activeTab === 'all' ? "You're all caught up" : 'Nothing here yet'}
        onSelect={handleSelect}
      />
    </section>
  )
}

export default NotificationPanel
