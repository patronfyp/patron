import { useEffect, useRef, useState } from 'react'

import { Popover } from 'antd'

import bellIcon from '@/assets/icons/bell-17.svg'
import Icon from '@/shared/components/Icon/Icon'

import { useUnreadCount } from '../hooks/useNotifications'

import styles from './NotificationBell.module.css'
import NotificationPanel from './NotificationPanel'

// A badge wider than this stops fitting the 20px chip, and "100" is no more
// useful to read than "99+".
const MAX_SHOWN_COUNT = 99

/**
 * The bell in the top bar (Figma "Top Navigation", 7:648): a 38px button with
 * the unread count on its corner, opening the notifications panel (14:968).
 *
 * Opening the panel refetches the count, so the number is current whenever
 * the list is.
 */
function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef(null)
  const { data: unreadCount = 0, refetch: refetchUnreadCount } = useUnreadCount()

  const handleOpenChange = (open) => {
    setIsOpen(open)
    if (open) refetchUnreadCount()
  }

  // Escape closes the panel and puts focus back on the bell it came from.
  // Listened for on the document so it works wherever focus is in the panel.
  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'

  return (
    // The panel is rendered inside this element (getPopupContainer below), so
    // it sits right after the button in the Tab order.
    <div className={styles.root}>
      <Popover
        open={isOpen}
        onOpenChange={handleOpenChange}
        trigger="click"
        placement="bottomRight"
        arrow={false}
        classNames={{ container: styles.popover }}
        getPopupContainer={(trigger) => trigger.parentElement}
        content={<NotificationPanel />}
      >
        <button
          ref={buttonRef}
          type="button"
          className={styles.button}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <Icon src={bellIcon} size={17} />
          {unreadCount > 0 ? (
            <span className={styles.badge} aria-hidden="true">
              {unreadCount > MAX_SHOWN_COUNT ? `${MAX_SHOWN_COUNT}+` : unreadCount}
            </span>
          ) : null}
        </button>
      </Popover>
    </div>
  )
}

export default NotificationBell
