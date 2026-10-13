import { DatePicker, Form, Input, Segmented, Select, Switch } from 'antd'

import calendarIcon from '@/assets/icons/calendar.svg'
import checkIcon from '@/assets/icons/check-12.svg'
import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import plusIcon from '@/assets/icons/plus-12.svg'
import xIcon from '@/assets/icons/x-12.svg'
import Icon from '@/shared/components/Icon/Icon'

import { SALARY_RANGE_PATTERN } from '../validation'

import styles from './PreferencesStep.module.css'

// DesiredRole and WorkMode in backend/app/modules/profiles/models.py.
const DESIRED_ROLES = [
  { value: 'backend_engineer', label: 'Backend Engineer' },
  { value: 'full_stack_engineer', label: 'Full-stack Engineer' },
  { value: 'platform_devops', label: 'Platform / DevOps' },
  { value: 'data_engineer', label: 'Data Engineer' },
  { value: 'frontend_engineer', label: 'Frontend Engineer' },
]

const WORK_MODES = [
  { value: 'on_site', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
]

const LOCATIONS = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Remote',
].map((city) => ({ value: city, label: city }))

/** Toggle chips - Figma Chip/accent (picked, with a tick) and Chip/neutral (+). */
function RoleChips({ value = [], onChange, id }) {
  function toggle(role) {
    onChange?.(value.includes(role) ? value.filter((item) => item !== role) : [...value, role])
  }

  return (
    <div className={styles.roles} id={id} role="group">
      {DESIRED_ROLES.map((role) => {
        const isPicked = value.includes(role.value)
        return (
          <button
            key={role.value}
            type="button"
            className={`${styles.roleChip} ${isPicked ? styles.picked : ''}`}
            aria-pressed={isPicked}
            onClick={() => toggle(role.value)}
          >
            <Icon src={isPicked ? checkIcon : plusIcon} size={12} />
            {role.label}
          </button>
        )
      })}
    </div>
  )
}

/** The "Let verified referrers find me" card with its switch (Figma 65:527). */
function VisibilityToggle({ value, onChange, id }) {
  return (
    <label className={styles.visibility} htmlFor={id}>
      <span className={styles.visibilityText}>
        <span className={styles.visibilityTitle}>Let verified referrers find me</span>
        <span className={styles.visibilityHint}>
          Alumni and employees can invite you to apply. Your current employer never sees you.
        </span>
      </span>
      <Switch id={id} checked={value} onChange={onChange} />
    </label>
  )
}

/** Step 7 - what the user is looking for (Figma 65:545). */
function PreferencesStep() {
  return (
    <div className={styles.fields}>
      <Form.Item name="desired_roles" label="Roles you want">
        <RoleChips />
      </Form.Item>

      <Form.Item name="work_mode" label="Work mode">
        <Segmented options={WORK_MODES} className={styles.segmented} />
      </Form.Item>

      <Form.Item name="preferred_locations" label="Preferred locations">
        <Select
          mode="multiple"
          options={LOCATIONS}
          placeholder="Pick the cities you'd work in"
          className={styles.locations}
          suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
          tagRender={({ label, closable, onClose }) => (
            <span className={styles.locationChip}>
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
          )}
        />
      </Form.Item>

      <div className={styles.row}>
        <Form.Item
          name="salary_range"
          label="Expected salary (monthly)"
          rules={[
            {
              pattern: SALARY_RANGE_PATTERN,
              message: 'Use a number or a range, e.g. 250,000 - 350,000',
            },
          ]}
        >
          <Input
            prefix={<span className={styles.prefix}>PKR</span>}
            placeholder="250,000 – 350,000"
          />
        </Form.Item>
        <Form.Item name="available_from" label="Available from">
          <DatePicker
            picker="month"
            format="MMMM YYYY"
            placeholder="Pick a month"
            className={styles.month}
            prefix={<Icon src={calendarIcon} className={styles.fieldIcon} />}
            suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
          />
        </Form.Item>
      </div>

      <Form.Item name="open_to_referrers" valuePropName="value">
        <VisibilityToggle />
      </Form.Item>
    </div>
  )
}

export default PreferencesStep
