import { useEffect, useState } from 'react'

import { Outlet, useMatches } from 'react-router-dom'

import { PeopleSearch } from '@/features/connections'

import styles from './AppLayout.module.css'
import Sidebar from './Sidebar'
import TopNavigation from './TopNavigation'

const DEFAULT_PAGE = { breadcrumb: ['Home', 'Overview'] }

/**
 * The frame around every signed-in page: sidebar on the left, then the top
 * navigation and the page (Figma Candidate · Overview, 10:2). A layout route -
 * pages render into the <Outlet>.
 *
 * Each route says what the top bar shows in its `handle`:
 * `{ breadcrumb: ['Home', 'Profile'], title: null }`. `title` undefined means
 * the greeting; `null` means no heading (the page has its own).
 *
 * The people-search overlay lives here, so the sidebar's and the top bar's
 * search boxes (and ⌘K / Ctrl+K) all open the same one.
 */
function AppLayout() {
  const matches = useMatches()
  const page = [...matches].reverse().find((match) => match.handle)?.handle ?? DEFAULT_PAGE
  const [searchOpen, setSearchOpen] = useState(false)
  const openSearch = () => setSearchOpen(true)

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={styles.shell}>
      <Sidebar onSearch={openSearch} />
      <div className={styles.content}>
        <TopNavigation breadcrumb={page.breadcrumb} title={page.title} onSearch={openSearch} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <PeopleSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

export default AppLayout
