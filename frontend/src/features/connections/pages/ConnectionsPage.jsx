import { useEffect, useState } from 'react'

import { Button, Input, Segmented } from 'antd'
import { useSearchParams } from 'react-router-dom'

import searchIcon from '@/assets/icons/search-16.svg'
import userCheckIcon from '@/assets/icons/user-check.svg'
import usersIcon from '@/assets/icons/users-16.svg'
import Icon from '@/shared/components/Icon/Icon'
import StatCard from '@/shared/components/StatCard/StatCard'

import ConnectionCard from '../components/ConnectionCard'
import RequestCard from '../components/RequestCard'
import {
  useConnectionCount,
  useConnectionRequests,
  useConnectionsInfinite,
} from '../hooks/useConnections'

import styles from './ConnectionsPage.module.css'

const TABS = ['all', 'requests', 'sent']
// Wait for a pause in typing before searching.
const SEARCH_DELAY_MS = 300

/** `value`, once it has stopped changing for `delay` ms. */
function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function Empty({ children }) {
  return <p className={styles.empty}>{children}</p>
}

/** "All": my connections, searchable, a page at a time. */
function AllConnections({ query }) {
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConnectionsInfinite(query)

  if (isPending) return <Empty>Loading your network…</Empty>
  if (isError) return <Empty>Couldn’t load your connections. Please refresh.</Empty>

  const items = data.pages.flatMap((page) => page.items)
  if (items.length === 0) {
    return (
      <Empty>
        {query
          ? `No one in your network matches “${query}”.`
          : 'No connections yet. Find people you know and ask to connect.'}
      </Empty>
    )
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((connection) => (
          <ConnectionCard key={connection.person.user_id} connection={connection} />
        ))}
      </div>
      {hasNextPage ? (
        <div className={styles.more}>
          <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
            Load more
          </Button>
        </div>
      ) : null}
    </>
  )
}

/** "Requests" (to me) or "Sent" (by me). */
function Requests({ requests, received }) {
  if (!requests) return <Empty>Loading…</Empty>
  if (requests.length === 0) {
    return (
      <Empty>
        {received ? 'No one is waiting for an answer.' : 'You have no requests waiting.'}
      </Empty>
    )
  }
  return (
    <div className={styles.grid}>
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  )
}

/**
 * "Your network" (Figma Candidate · Connections, 14:370), with real data
 * only: the connection count and waiting requests, then my connections or
 * my pending requests. Figma's "Can refer you", "Companies reached" and
 * "Alumni at target companies" join once referrals exist.
 */
function ConnectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'all'
  const [search, setSearch] = useState('')
  const query = useDebounced(search.trim(), SEARCH_DELAY_MS)

  const { data: total } = useConnectionCount()
  const { data: received } = useConnectionRequests('received')
  const { data: sent } = useConnectionRequests('sent')

  const label = (name, list) => (list?.length ? `${name} (${list.length})` : name)
  const selectTab = (value) =>
    setSearchParams(value === 'all' ? {} : { tab: value }, { replace: true })

  return (
    <div className={styles.page}>
      <div className={styles.stats}>
        <StatCard label="Connections" value={total} icon={usersIcon} tone="accent" />
        <StatCard
          label="Requests waiting"
          value={received?.length}
          icon={userCheckIcon}
          tone="warning"
          caption={received?.length ? 'People who want to connect' : 'No one is waiting on you'}
        />
      </div>

      <div className={styles.toolbar}>
        <Segmented
          value={tab}
          onChange={selectTab}
          options={[
            { value: 'all', label: 'All' },
            { value: 'requests', label: label('Requests', received) },
            { value: 'sent', label: label('Sent', sent) },
          ]}
        />
        {tab === 'all' ? (
          <Input
            className={styles.search}
            prefix={<Icon src={searchIcon} className={styles.searchIcon} />}
            placeholder="Search your network"
            aria-label="Search your network"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            allowClear
          />
        ) : null}
      </div>

      {tab === 'all' ? <AllConnections query={query} /> : null}
      {tab === 'requests' ? <Requests requests={received} received /> : null}
      {tab === 'sent' ? <Requests requests={sent} received={false} /> : null}
    </div>
  )
}

export default ConnectionsPage
