import checkCircleIcon from '@/assets/icons/check-circle-15.svg'
import shieldIcon from '@/assets/icons/shield-15.svg'

/**
 * The panel's tabs (Figma 14:914). `categories` is which notification
 * categories a tab shows; `null` means all of them.
 */
export const TABS = [
  { key: 'all', label: 'All', categories: null },
  { key: 'referrals', label: 'Referrals', categories: ['referrals'] },
  { key: 'verification', label: 'Verification', categories: ['verification'] },
]

/**
 * How each backend notification `type` looks: the icon on its row, the colour
 * the icon and its tile take (a `--patron-status-*` token pair), and the tab
 * it belongs to. Add a line here when the backend gains a type - an unknown
 * type falls back to `FALLBACK_META`, so a new type never breaks the panel.
 */
const TYPE_META = {
  email_verified: { icon: checkCircleIcon, tone: 'success', category: 'verification' },
  document_uploaded: { icon: shieldIcon, tone: 'warning', category: 'verification' },
}

const FALLBACK_META = { icon: null, tone: 'neutral', category: 'other' }

/** @param {string} type - a Notification's `type` */
export function getTypeMeta(type) {
  return TYPE_META[type] ?? FALLBACK_META
}

/**
 * The notifications a tab shows.
 *
 * @param {import('../api/notifications.api').Notification[]} items
 * @param {string} tabKey
 */
export function filterByTab(items, tabKey) {
  const { categories } = TABS.find((tab) => tab.key === tabKey) ?? TABS[0]
  if (!categories) return items
  return items.filter((item) => categories.includes(getTypeMeta(item.type).category))
}

/**
 * Only an app path is followed from a notification: a path starting with a
 * single "/". A full URL or "//host" would send the user off-site.
 *
 * @param {string | null} link
 */
export function isAppPath(link) {
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')
}
