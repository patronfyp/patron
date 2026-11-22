import chevronRightIcon from '@/assets/icons/chevron-right-12.svg'
import searchIcon from '@/assets/icons/search-15.svg'
import { useAuthStore } from '@/features/auth'
import { NotificationBell } from '@/features/notifications'
import Icon from '@/shared/components/Icon/Icon'

import { getFirstName, getGreeting, getInitials } from './greeting'
import styles from './TopNavigation.module.css'

/**
 * The top bar of every signed-in page (Figma 7:648): breadcrumb and heading;
 * search, notifications and avatar.
 *
 * @param {object} props
 * @param {string[]} props.breadcrumb - labels, outermost first; the last is the current page
 * @param {string | null} [props.title] - the heading; defaults to "Good morning, <first name>";
 *   `null` leaves it out, for a page with a heading of its own (Profile, 14:2)
 */
function TopNavigation({ breadcrumb, title }) {
  const user = useAuthStore((state) => state.user)

  const firstName = getFirstName(user?.full_name)
  const greeting = firstName ? `${getGreeting()}, ${firstName}` : getGreeting()
  const heading = title === undefined ? greeting : title

  return (
    <header className={styles.bar}>
      <div className={styles.heading}>
        <nav aria-label="Breadcrumb">
          <ol className={styles.breadcrumb}>
            {breadcrumb.map((label, index) => {
              const isCurrent = index === breadcrumb.length - 1
              return (
                <li
                  key={label}
                  className={styles.crumb}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {index > 0 ? <Icon src={chevronRightIcon} size={12} /> : null}
                  {label}
                </li>
              )
            })}
          </ol>
        </nav>
        {heading === null ? null : <h1 className={styles.title}>{heading}</h1>}
      </div>

      <div className={styles.actions}>
        {/* Search is not built yet: it looks as Figma draws it and does nothing. */}
        <button
          type="button"
          className={styles.search}
          aria-disabled="true"
          title="Search is coming soon"
        >
          <Icon src={searchIcon} size={15} />
          <span className={styles.placeholder}>Search jobs, people, companies</span>
          <kbd className={styles.key}>⌘K</kbd>
        </button>

        <NotificationBell />

        <span className={styles.avatar} role="img" aria-label={user?.full_name ?? 'Your account'}>
          {getInitials(user?.full_name)}
        </span>
      </div>
    </header>
  )
}

export default TopNavigation
