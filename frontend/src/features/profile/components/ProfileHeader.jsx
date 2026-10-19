import { App, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

import coverGlow from '@/assets/brand/profile-cover-glow.svg'
import coverGrid from '@/assets/brand/profile-cover-grid.svg'
import building14Icon from '@/assets/icons/building-14.svg'
import capIcon from '@/assets/icons/cap-14.svg'
import checkIcon from '@/assets/icons/check-14.svg'
import clock12Icon from '@/assets/icons/clock-12.svg'
import penIcon from '@/assets/icons/pen-16.svg'
import shareIcon from '@/assets/icons/share-16.svg'
import Icon from '@/shared/components/Icon/Icon'

import { headlineLine, initials, profilePhoto, shortUniversity, shortYear } from '../profileView'

import ProfileChip from './ProfileChip'
import styles from './ProfileHeader.module.css'

/** The trust chips under the headline: one each for the university and the employer. */
function TrustChips({ profile }) {
  const university = shortUniversity(profile.university)
  const year = shortYear(profile.graduation_year)

  return (
    <div className={styles.chips}>
      {profile.university && profile.university_verified ? (
        <ProfileChip tone="alum" icon={capIcon} iconSize={14} large trust>
          {[university, year].filter(Boolean).join(' ')} · Verified
        </ProfileChip>
      ) : null}
      {profile.university && !profile.university_verified ? (
        <ProfileChip tone="warning" icon={clock12Icon} large>
          {university} · not verified
        </ProfileChip>
      ) : null}
      {profile.employer_name && profile.employer_verified ? (
        <ProfileChip tone="emp" icon={building14Icon} iconSize={14} large trust>
          {profile.employer_name} · Verified employee
        </ProfileChip>
      ) : null}
      {profile.employer_name && !profile.employer_verified ? (
        <ProfileChip tone="warning" icon={clock12Icon} large>
          {profile.employer_name} · not verified
        </ProfileChip>
      ) : null}
    </div>
  )
}

/**
 * The identity card (Figma 14:191): cover, photo, name, headline and trust chips.
 *
 * @param {object} props
 * @param {import('../api/profile.api').PublicProfile} props.profile
 * @param {boolean} [props.isOwn] - adds "Edit profile", for the signed-in person's own profile
 */
function ProfileHeader({ profile, isOwn = false }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const photo = profilePhoto(profile)
  const isVerified = profile.university_verified || profile.employer_verified

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('Profile link copied')
    } catch {
      message.error('Could not copy the link')
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cover}>
        <img className={styles.glow} src={coverGlow} alt="" />
        <img className={styles.grid} src={coverGrid} alt="" />
      </div>

      <div className={styles.identity}>
        <div className={styles.top}>
          <span className={styles.avatar}>
            {photo ? <img src={photo} alt={profile.full_name} /> : initials(profile.full_name)}
          </span>
          <div className={styles.actions}>
            <Button className={styles.share} onClick={handleShare}>
              <Icon src={shareIcon} size={16} />
              Share profile
            </Button>
            {isOwn ? (
              <Button
                type="primary"
                className={styles.edit}
                onClick={() => navigate('/profile/edit')}
              >
                <Icon src={penIcon} size={16} />
                Edit profile
              </Button>
            ) : null}
          </div>
        </div>

        <div className={styles.text}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{profile.full_name}</h1>
            {isVerified ? (
              <span className={styles.tick} role="img" aria-label="Verified">
                <Icon src={checkIcon} size={14} />
              </span>
            ) : null}
          </div>
          {headlineLine(profile) ? (
            <p className={styles.headline}>{headlineLine(profile)}</p>
          ) : null}
          <TrustChips profile={profile} />
        </div>
      </div>
    </section>
  )
}

export default ProfileHeader
