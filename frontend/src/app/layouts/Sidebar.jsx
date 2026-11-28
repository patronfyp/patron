import { Dropdown } from 'antd'
import { NavLink, useNavigate } from 'react-router-dom'

import patronMark from '@/assets/brand/patron-mark.svg'
import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import homeIcon from '@/assets/icons/home-16.svg'
import searchIcon from '@/assets/icons/search-15.svg'
import userIcon from '@/assets/icons/user-16.svg'
import usersIcon from '@/assets/icons/users-16.svg'
import { useAuthStore, useLogout } from '@/features/auth'
import { useConnectionRequests } from '@/features/connections'
import { useProfile } from '@/features/onboarding'
import { fileUrl } from '@/shared/api/fileUrl'
import Icon from '@/shared/components/Icon/Icon'

import { getInitials } from './greeting'
import styles from './Sidebar.module.css'

const ROLE_LABELS = {
  candidate: 'Candidate',
  referrer: 'Referrer',
  recruiter: 'Recruiter',
  admin: 'Admin',
}

/**
 * Only pages that exist. Figma's Jobs, Applications, Referrals, Alumni, CV
 * Builder and AI Assistant join as they are built - never as dead links.
 *
 * @param {string | undefined} userId
 */
function navItems(userId) {
  return [
    { to: '/', label: 'Overview', icon: homeIcon, end: true },
    { to: '/connections', label: 'Connections', icon: usersIcon, badge: true },
    { to: `/profile/${userId}`, label: 'Profile', icon: userIcon },
  ]
}

/** The signed-in user's photo, or their initials on the accent gradient. */
function Avatar({ name, photoUrl }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {photoUrl ? <img className={styles.photo} src={photoUrl} alt="" /> : getInitials(name)}
    </span>
  )
}

/**
 * The left sidebar of every signed-in page (Figma Sidebar / Candidate, 7:647):
 * logo, search, the workspace links, and the account menu at the bottom.
 */
function Sidebar({ onSearch }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const user = useAuthStore((state) => state.user)
  const { data: profile } = useProfile()
  // The Connections link's chip: how many people are waiting for an answer.
  const { data: waiting } = useConnectionRequests('received')

  // The headline under the name, as Figma shows it; the role until one is written.
  const subline = profile?.headline || ROLE_LABELS[user?.roles?.[0]] || ''

  const menu = {
    items: [
      { key: 'profile', label: 'View profile' },
      { key: 'edit', label: 'Edit profile' },
      { key: 'settings', label: 'Settings' },
      { type: 'divider' },
      { key: 'logout', label: 'Sign out', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') logout()
      if (key === 'profile') navigate(`/profile/${user?.id}`)
      if (key === 'edit') navigate('/profile/edit')
      if (key === 'settings') navigate('/settings')
    },
  }

  return (
    <aside className={styles.sidebar} aria-label="Main">
      <div className={styles.logo}>
        <img src={patronMark} alt="" width={26} height={26} />
        <span className={styles.wordmark}>PATRON</span>
      </div>

      <button type="button" className={styles.search} onClick={onSearch}>
        <Icon src={searchIcon} size={15} />
        <span className={styles.searchText}>Search PATRON</span>
        <kbd className={styles.key}>⌘K</kbd>
      </button>

      <p className={styles.section}>Your workspace</p>

      <nav aria-label="Workspace">
        <ul className={styles.nav}>
          {navItems(user?.id).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                }
              >
                <Icon src={item.icon} className={styles.linkIcon} />
                <span className={styles.linkLabel}>{item.label}</span>
                {item.badge && waiting?.length ? (
                  <span className={styles.badge} aria-label={`${waiting.length} waiting`}>
                    {waiting.length}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Dropdown menu={menu} trigger={['click']} placement="topLeft">
        <button type="button" className={styles.account} aria-label="Account menu">
          <Avatar
            name={user?.full_name}
            photoUrl={fileUrl(profile?.photo_url) ?? user?.avatar_url}
          />
          <span className={styles.who}>
            <span className={styles.name}>{user?.full_name}</span>
            {subline ? <span className={styles.subline}>{subline}</span> : null}
          </span>
          <Icon src={chevronDownIcon} className={styles.chevron} />
        </button>
      </Dropdown>
    </aside>
  )
}

export default Sidebar
