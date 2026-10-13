import { Form, Segmented, Select } from 'antd'

import xIcon from '@/assets/icons/x-12.svg'
import Icon from '@/shared/components/Icon/Icon'

import styles from './SkillsStep.module.css'

// PrimaryRole in backend/app/modules/profiles/models.py.
const PRIMARY_ROLES = [
  { value: 'full_stack', label: 'Full-stack' },
  { value: 'backend', label: 'Backend' },
  { value: 'ai_ml', label: 'AI / ML' },
  { value: 'frontend', label: 'Frontend' },
]

const MAX_SKILLS = 30 // ProfileUpdate.skills in profiles/schemas.py

/** A removable skill chip - Figma Chip/neutral with an x (9:425). */
function SkillChip({ label, closable, onClose }) {
  return (
    <span className={styles.chip}>
      {label}
      {closable ? (
        <button
          type="button"
          className={styles.chipRemove}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClose}
          aria-label={`Remove ${label}`}
        >
          <Icon src={xIcon} size={12} />
        </button>
      ) : null}
    </span>
  )
}

/**
 * Step 6 - skills and a primary role (Figma 9:549). Skills are typed by the
 * user; reading them from the CV and GitHub waits for the AI module.
 */
function SkillsStep() {
  return (
    <div className={styles.fields}>
      <Form.Item
        name="skills"
        label="Skills"
        extra="Type a skill and press Enter."
        rules={[
          {
            type: 'array',
            max: MAX_SKILLS,
            message: `Add at most ${MAX_SKILLS} skills`,
          },
        ]}
      >
        <Select
          mode="tags"
          className={styles.skills}
          placeholder="e.g. React, Python, PostgreSQL"
          open={false}
          suffixIcon={null}
          tokenSeparators={[',']}
          tagRender={({ label, closable, onClose }) => (
            <SkillChip label={label} closable={closable} onClose={onClose} />
          )}
        />
      </Form.Item>

      <Form.Item name="primary_role" label="Primary role">
        <Segmented options={PRIMARY_ROLES} className={styles.segmented} />
      </Form.Item>
    </div>
  )
}

export default SkillsStep
