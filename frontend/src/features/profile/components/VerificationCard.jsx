import checkCircleIcon from '@/assets/icons/check-circle-16.svg'
import clockIcon from '@/assets/icons/clock-16.svg'
import linkIcon from '@/assets/icons/link-16.svg'
import Icon from '@/shared/components/Icon/Icon'

import { safeWebUrl, shortUniversity } from '../lib/profileView'

import ProfileCard from './ProfileCard'
import ProfileChip from './ProfileChip'
import styles from './VerificationCard.module.css'

function VerificationRow({ icon, tone, title, detail, chip }) {
  return (
    <li className={styles.row}>
      <Icon src={icon} size={16} className={styles[tone]} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.detail}>{detail}</span>
      </span>
      {chip}
    </li>
  )
}

/** One row per check we hold something for: university, employer, LinkedIn. */
function verificationRows(profile) {
  const rows = []

  const check = (isVerified) =>
    isVerified
      ? {
          icon: checkCircleIcon,
          tone: 'success',
          chip: <ProfileChip tone="success">Verified</ProfileChip>,
        }
      : {
          icon: clockIcon,
          tone: 'warning',
          chip: <ProfileChip tone="warning">Not verified</ProfileChip>,
        }

  if (profile.university) {
    rows.push({
      key: 'university',
      title: `University · ${shortUniversity(profile.university)}`,
      detail: profile.university_verified ? 'University email' : 'Not verified yet',
      ...check(profile.university_verified),
    })
  }

  if (profile.employer_name) {
    rows.push({
      key: 'employer',
      title: `Employer · ${profile.employer_name}`,
      detail: profile.employer_verified ? 'Work email' : 'Not verified yet',
      ...check(profile.employer_verified),
    })
  }

  const linkedin = safeWebUrl(profile.linkedin_url)
  if (linkedin) {
    rows.push({
      key: 'linkedin',
      icon: linkIcon,
      tone: 'accent',
      title: (
        <a href={linkedin} target="_blank" rel="noopener noreferrer" className={styles.link}>
          LinkedIn
        </a>
      ),
      detail: 'Profile linked',
      chip: <ProfileChip tone="accent">Linked</ProfileChip>,
    })
  }

  return rows
}

/** Figma Verification center (14:317). */
function VerificationCard({ profile }) {
  const rows = verificationRows(profile)

  return (
    <ProfileCard title="Verification center" column="side">
      {rows.length ? (
        <ul className={styles.rows}>
          {rows.map(({ key, ...row }) => (
            <VerificationRow key={key} {...row} />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Nothing to verify yet.</p>
      )}
    </ProfileCard>
  )
}

export default VerificationCard
