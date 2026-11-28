import { App, Button, Dropdown } from 'antd'
import { Link, useNavigate } from 'react-router-dom'

import dotsIcon from '@/assets/icons/dots-18.svg'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'
import PersonAvatar from '@/shared/components/PersonAvatar/PersonAvatar'

import { useRemoveConnection } from '../hooks/useConnections'
import { CONNECTION_TYPES, personSubline } from '../lib/connectionTypes'

import styles from './ConnectionCard.module.css'

/** "Professional", "Alumni" or "Professional + Alumni" (Chip/neutral, /alum, /dv). */
export function TypeChip({ type }) {
  const meta = CONNECTION_TYPES[type] ?? CONNECTION_TYPES.professional
  return (
    <span className={`${styles.chip} ${styles[meta.tone]}`}>
      <Icon src={meta.icon} size={12} />
      {meta.label}
    </span>
  )
}

/**
 * One connection (Figma Connection Card, 14:513): who they are, how we're
 * connected, our mutual connections, and a menu to remove them.
 *
 * Figma's trust badge (company / class year) is left out: the list doesn't
 * say whether that's verified for them, and an unverified "verified" badge
 * is the one thing a trust product can't show. Figma's Message button waits
 * for messaging; View profile stands in.
 *
 * @param {object} props
 * @param {{ person: import('../api/connections.api').PersonSummary, connection_type: string, mutual_count: number }} props.connection
 */
function ConnectionCard({ connection }) {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const remove = useRemoveConnection()
  const { person } = connection
  const profilePath = `/profile/${person.user_id}`

  const confirmRemove = () =>
    modal.confirm({
      title: `Remove ${person.full_name}?`,
      content: 'You won’t be connected any more. They aren’t told.',
      okText: 'Remove',
      okButtonProps: { danger: true },
      onOk: () =>
        remove.mutateAsync(person.user_id).then(
          () => message.success('Connection removed'),
          (error) => message.error(getApiErrorMessage(error, 'Couldn’t remove. Please try again.')),
        ),
    })

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <PersonAvatar person={person} />
        <div className={styles.who}>
          <Link to={profilePath} className={styles.name}>
            {person.full_name}
          </Link>
          <span className={styles.subline}>{personSubline(person)}</span>
        </div>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [{ key: 'remove', label: 'Remove connection', danger: true }],
            onClick: confirmRemove,
          }}
        >
          <button type="button" className={styles.more} aria-label={`More for ${person.full_name}`}>
            <Icon src={dotsIcon} size={18} />
          </button>
        </Dropdown>
      </div>

      <div className={styles.chips}>
        <TypeChip type={connection.connection_type} />
      </div>

      <div className={styles.foot}>
        <span className={styles.mutual}>
          {connection.mutual_count ? `${connection.mutual_count} mutual` : 'No mutual connections'}
        </span>
        <Button size="small" className={styles.view} onClick={() => navigate(profilePath)}>
          View profile
        </Button>
      </div>
    </article>
  )
}

export default ConnectionCard
