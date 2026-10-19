import { Button, Flex, Result, Spin } from 'antd'
import { Link, useParams } from 'react-router-dom'

import { useAuthStore } from '@/features/auth'

import AboutCard from '../components/AboutCard'
import ExperienceCard from '../components/ExperienceCard'
import ProfileHeader from '../components/ProfileHeader'
import SkillsCard from '../components/SkillsCard'
import VerificationCard from '../components/VerificationCard'
import { usePublicProfile } from '../hooks/usePublicProfile'

import styles from './ProfilePage.module.css'

/** `/profile/:userId` - someone's public profile (Figma "Candidate · Profile", 14:2). */
function ProfilePage() {
  const { userId } = useParams()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const { data: profile, isPending, isError, error, refetch } = usePublicProfile(userId)

  if (isPending) {
    return (
      <Flex justify="center" role="status" aria-label="Loading profile" style={{ padding: 80 }}>
        <Spin size="large" />
      </Flex>
    )
  }

  if (isError) {
    // 404: no such user, or a deactivated one. 422: the id is not a UUID, so
    // it cannot be anyone's. Neither will answer differently on a retry.
    const status = error?.response?.status
    if (status === 404 || status === 422) {
      return (
        <div className={styles.page}>
          <Result
            status="404"
            title="Profile not found"
            subTitle="This profile does not exist, or the account is no longer active."
            extra={
              <Link to="/">
                <Button type="primary">Back to home</Button>
              </Link>
            }
          />
        </div>
      )
    }

    return (
      <div className={styles.page}>
        <Result
          status="error"
          title="Could not load this profile"
          subTitle="Check your connection and try again."
          extra={
            <Button type="primary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <ProfileHeader profile={profile} isOwn={userId === currentUserId} />
      <div className={styles.columns}>
        <div className={styles.main}>
          <AboutCard bio={profile.bio} />
          <ExperienceCard profile={profile} />
        </div>
        <div className={styles.side}>
          <VerificationCard profile={profile} />
          <SkillsCard skills={profile.skills} />
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
