import ProfileCard from './ProfileCard'
import ProfileChip from './ProfileChip'
import styles from './SkillsCard.module.css'

/** Figma Skills (14:338). */
function SkillsCard({ skills }) {
  return (
    <ProfileCard title="Skills" column="side">
      {skills.length ? (
        <ul className={styles.chips}>
          {skills.map((skill) => (
            <li key={skill}>
              <ProfileChip tone="neutral" large>
                {skill}
              </ProfileChip>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No skills added yet.</p>
      )}
    </ProfileCard>
  )
}

export default SkillsCard
