import styles from './AppLayout.module.css'
import TopNavigation from './TopNavigation'

/**
 * The frame around a signed-in page: the top navigation, then the page.
 *
 * The Figma pages also have a left sidebar; it is not built yet. Until it is,
 * the top bar spans the full width.
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
