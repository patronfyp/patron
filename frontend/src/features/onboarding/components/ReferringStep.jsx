import { Form, Segmented } from 'antd'

import styles from './ReferringStep.module.css'
import ToggleCard from './ToggleCard'
import ToggleChips from './ToggleChips'

// ReferralTeam and MONTHLY_REFERRAL_LIMITS in backend/app/modules/profiles/models.py.
const TEAMS = [
  { value: 'backend', label: 'Backend' },
  { value: 'full_stack', label: 'Full-stack' },
  { value: 'platform', label: 'Platform' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'data', label: 'Data' },
  { value: 'product', label: 'Product' },
]

// "No limit" is null on the profile; Segmented needs a value it can select.
const NO_LIMIT = 'none'
const LIMITS = [
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: NO_LIMIT, label: 'No limit' },
]

/** "Lahore University of Management Sciences (LUMS)" -> "LUMS". */
function shortName(university) {
  return university?.match(/\(([^)]+)\)/)?.[1] ?? university
}

/**
 * The referrer's step 3 - which requests, and how many (Figma 67:641).
 * No bonus box: there's no bonus data.
 *
 * @param {object} props
 * @param {string | null} [props.verifiedUniversity] - set only when the user's
 *   university email is verified; the alumni toggle shows only then
 */
function ReferringStep({ verifiedUniversity }) {
  const university = shortName(verifiedUniversity)

  return (
    <div className={styles.fields}>
      <Form.Item name="referral_teams" label="Teams you can refer for">
        <ToggleChips options={TEAMS} />
      </Form.Item>

      <Form.Item
        name="monthly_referral_limit"
        label="Requests per month"
        getValueProps={(value) => ({ value: value ?? NO_LIMIT })}
        normalize={(value) => (value === NO_LIMIT ? null : value)}
      >
        <Segmented options={LIMITS} className={styles.segmented} />
      </Form.Item>

      {university ? (
        <Form.Item name="accept_alumni_requests" valuePropName="value">
          <ToggleCard
            title={`Accept requests from ${university} alumni`}
            hint={`You are a verified ${university} alum. Alumni get a plum badge on their requests.`}
          />
        </Form.Item>
      ) : null}

      <Form.Item name="accept_any_verified_requests" valuePropName="value">
        <ToggleCard
          title="Accept requests from any verified candidate"
          hint="Turn off to only hear from alumni and people you know."
        />
      </Form.Item>
    </div>
  )
}

export default ReferringStep
