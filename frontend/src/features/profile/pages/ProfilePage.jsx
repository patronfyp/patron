import { Alert, Flex, Spin } from 'antd'
import { useParams } from 'react-router-dom'

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
  const { data: profile, isPending, isError } = usePublicProfile(userId)

  if (isPending) {
    return (
      <Flex justify="center" style={{ padding: 80 }}>
        <Spin size="large" />
      </Flex>
    )
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <Alert type="error" showIcon title="Could not load this profile." />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <ProfileHeader profile={profile} />
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
