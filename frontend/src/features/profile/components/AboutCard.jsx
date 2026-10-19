import styles from './AboutCard.module.css'
import ProfileCard from './ProfileCard'

/** The bio (Figma About, 14:194). */
function AboutCard({ bio }) {
  return (
    <ProfileCard title="About">
      <p className={bio ? styles.text : styles.empty}>{bio || 'No bio added yet.'}</p>
    </ProfileCard>
  )
}

export default AboutCard
