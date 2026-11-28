import { Link } from 'react-router-dom'

import PersonAvatar from '@/shared/components/PersonAvatar/PersonAvatar'

import { personSubline } from '../lib/connectionTypes'

import ConnectButton from './ConnectButton'
import styles from './ConnectionCard.module.css'

/**
 * A pending request, in the Connection Card's shape: Accept / Decline when
 * it was sent to me, Pending (withdraw) when I sent it. Figma has no request
 * screen, so this reuses the card.
 *
 * @param {object} props
 * @param {{ id: string, direction: 'received' | 'sent', person: import('../api/connections.api').PersonSummary }} props.request
 */
function RequestCard({ request }) {
  const { person } = request
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <PersonAvatar person={person} />
        <div className={styles.who}>
          <Link to={`/profile/${person.user_id}`} className={styles.name}>
            {person.full_name}
          </Link>
          <span className={styles.subline}>{personSubline(person)}</span>
        </div>
      </div>
      <div className={styles.foot}>
        <span className={styles.mutual}>
          {request.direction === 'received' ? 'Wants to connect' : 'Waiting for their answer'}
        </span>
        <ConnectButton
          userId={person.user_id}
          status={request.direction === 'received' ? 'pending_received' : 'pending_sent'}
          requestId={request.id}
          size="small"
        />
      </div>
    </article>
  )
}

export default RequestCard
