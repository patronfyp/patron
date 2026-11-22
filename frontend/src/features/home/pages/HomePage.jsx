import bellIcon from '@/assets/icons/bell-16.svg'
import userCheckIcon from '@/assets/icons/user-check.svg'
import usersIcon from '@/assets/icons/users-16.svg'
import { useAuthStore } from '@/features/auth'
import { useConnectionCount, useConnectionRequests } from '@/features/connections'
import { useUnreadCount } from '@/features/notifications'
import { profileStrength, useProfile } from '@/features/onboarding'
import { useVerificationStatus } from '@/features/verification'
import StatCard from '@/shared/components/StatCard/StatCard'

import ReadinessCard from '../components/ReadinessCard'
import RecentActivity from '../components/RecentActivity'

import styles from './HomePage.module.css'

/**
 * The signed-in home (Figma Candidate · Overview, 10:2), with real data only:
 * profile readiness for candidates, network and notification counts, and the
 * latest activity. Figma's jobs, referrals, profile views and AI cards join
 * once those features exist - never with made-up numbers.
 */
function HomePage() {
  const user = useAuthStore((state) => state.user)
  const { data: profile } = useProfile()
  const { data: status } = useVerificationStatus()
  const { data: connections } = useConnectionCount()
  const { data: requests } = useConnectionRequests('received')
  const { data: unread } = useUnreadCount()

  // Profile strength measures a candidate's profile (CV, skills, roles).
  const isCandidate = user?.roles?.includes('candidate')
  const waiting = requests?.length

  return (
    <div className={styles.page}>
      {isCandidate && profile && status ? (
        <ReadinessCard
          strength={profileStrength(profile, status)}
          status={status}
          profilePath={`/profile/${user.id}`}
        />
      ) : null}

      <div className={styles.columns}>
        <div className={styles.stats}>
          <StatCard
            label="Connections"
            value={connections}
            icon={usersIcon}
            tone="accent"
            caption="People you’re connected with"
          />
          <StatCard
            label="Requests waiting"
            value={waiting}
            icon={userCheckIcon}
            tone="warning"
            caption={waiting ? 'People who want to connect' : 'No one is waiting on you'}
          />
          <StatCard
            label="Unread notifications"
            value={unread}
            icon={bellIcon}
            caption="Open the bell to catch up"
          />
        </div>
        <RecentActivity />
      </div>
    </div>
  )
}

export default HomePage
