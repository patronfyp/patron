import capIcon from '@/assets/icons/cap-12.svg'
import checkCircleIcon from '@/assets/icons/check-circle-12.svg'
import clockIcon from '@/assets/icons/clock-12.svg'

import { shortUniversity } from '../lib/profileView'

import styles from './ExperienceCard.module.css'
import ProfileCard from './ProfileCard'
import ProfileChip from './ProfileChip'

/**
 * The employer and the degree as Figma's Experience rows. The API holds no job
 * title, dates or description, so a row is the name, its chip and, for the
 * degree, "University · year".
 */
function experienceRows(profile) {
  const rows = []

  if (profile.employer_name) {
    rows.push({
      key: 'employer',
      logo: profile.employer_name,
      title: profile.employer_name,
      detail: null,
      chip: profile.employer_verified ? (
        <ProfileChip tone="success" icon={checkCircleIcon}>
          Verified
        </ProfileChip>
      ) : (
        <ProfileChip tone="warning" icon={clockIcon}>
          Not verified
        </ProfileChip>
      ),
    })
  }

  if (profile.university) {
    rows.push({
      key: 'education',
      logo: shortUniversity(profile.university),
      title: profile.degree || profile.university,
      detail: [shortUniversity(profile.university), profile.graduation_year]
        .filter(Boolean)
        .join(' · '),
      chip: profile.university_verified ? (
        <ProfileChip tone="alum" icon={capIcon}>
          Verified
        </ProfileChip>
      ) : (
        <ProfileChip tone="warning" icon={clockIcon}>
          Not verified
        </ProfileChip>
      ),
    })
  }

  return rows
}

/** Figma Experience (14:239). */
function ExperienceCard({ profile }) {
  const rows = experienceRows(profile)

  return (
    <ProfileCard title="Experience" tight>
      {rows.length ? (
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.key} className={styles.row}>
              <span className={styles.logo} aria-hidden="true">
                {row.logo[0].toUpperCase()}
              </span>
              <div className={styles.body}>
                <div className={styles.titleRow}>
                  <h3 className={styles.title}>{row.title}</h3>
                  {row.chip}
                </div>
                {row.detail ? <p className={styles.detail}>{row.detail}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No employer or education added yet.</p>
      )}
    </ProfileCard>
  )
}

export default ExperienceCard
