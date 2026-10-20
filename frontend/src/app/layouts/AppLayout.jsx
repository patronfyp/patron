import styles from './AppLayout.module.css'
import TopNavigation from './TopNavigation'

/**
 * The frame around a signed-in page: top navigation, then the page.
 * Figma's left sidebar isn't built yet.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children - the page
 * @param {string[]} [props.breadcrumb] - the trail shown above the heading
 * @param {string} [props.title] - overrides the greeting as the heading
 */
function AppLayout({ children, breadcrumb = ['Home', 'Overview'], title }) {
  return (
    <div className={styles.shell}>
      <TopNavigation breadcrumb={breadcrumb} title={title} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}

export default AppLayout
