import { Outlet, useMatches } from 'react-router-dom'

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
 */
function AppLayout() {
  const matches = useMatches()
  const page = [...matches].reverse().find((match) => match.handle)?.handle ?? DEFAULT_PAGE

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.content}>
        <TopNavigation breadcrumb={page.breadcrumb} title={page.title} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
