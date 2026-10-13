import { Form, Select } from 'antd'

import checkCircleIcon from '@/assets/icons/check-circle-12.svg'
import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import sparkleIcon from '@/assets/icons/sparkle-16.svg'
import Icon from '@/shared/components/Icon/Icon'

import EmailCodeVerification from './EmailCodeVerification'
import styles from './EmployerStep.module.css'

// Placeholder data: there is no company lookup API yet, so the companies and
// their details below are fixed until the backend provides one.
const COMPANIES = [
  { name: 'Garner', domain: 'garner.com', size: '400 employees' },
  { name: 'Systems Limited', domain: 'systemsltd.com', size: '5,000+ employees' },
  { name: 'Arbisoft', domain: 'arbisoft.com', size: '900 employees' },
  { name: '10Pearls', domain: '10pearls.com', size: '1,200 employees' },
  { name: 'NetSol Technologies', domain: 'netsoltech.com', size: '1,800 employees' },
  { name: 'Careem', domain: 'careem.com', size: '3,000 employees' },
  { name: 'Afiniti', domain: 'afiniti.com', size: '1,000 employees' },
  { name: 'Motive', domain: 'gomotive.com', size: '2,500 employees' },
]

const COMPANY_OPTIONS = COMPANIES.map((company) => ({
  value: company.name,
  label: company.name,
}))

/**
 * Step 4 - the employer and a work-email code (Figma 9:337).
 *
 * @param {object} props
 * @param {boolean} props.isRequired - false for anyone who isn't a referrer
 * @param {string | null} [props.verifiedEmail] - a work email already verified
 */
function EmployerStep({ isRequired, verifiedEmail }) {
  const employerName = Form.useWatch('employer_name')
  const company = COMPANIES.find((item) => item.name === employerName)
  // Only true once a work email on the company's own domain is verified -
  // choosing the company alone proves nothing.
  const isDomainMatched = Boolean(
    company && verifiedEmail?.toLowerCase().endsWith(`@${company.domain}`),
  )

  return (
    <div className={styles.fields}>
      <Form.Item
        name="employer_name"
        label="Company"
        rules={[{ required: isRequired, message: 'Select the company you work at' }]}
      >
        <Select
          showSearch
          allowClear
          placeholder="Search for your company"
          options={COMPANY_OPTIONS}
          suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
        />
      </Form.Item>

      {company ? (
        <div className={styles.verifyGroup}>
          <div className={styles.company}>
            {/* No company logos yet - the initial stands in. */}
            <span className={styles.logo} aria-hidden="true">
              {company.name.charAt(0).toLowerCase()}
            </span>
            <span className={styles.companyText}>
              <span className={styles.companyName}>{company.name}</span>
              <span className={styles.companyMeta}>
                {company.domain} &middot; {company.size}
              </span>
            </span>
            {isDomainMatched ? (
              <span className={styles.matched}>
                <Icon src={checkCircleIcon} size={12} />
                Domain matched
              </span>
            ) : null}
          </div>

          <EmailCodeVerification
            key={company.name}
            kind="employer"
            label={`Work email at ${company.name}`}
            placeholder={`you@${company.domain}`}
            helpText="Use your work email, not a personal one - PATRON checks it isn't a free mailbox."
            verifiedEmail={verifiedEmail}
          />

          <p className={styles.tip}>
            <Icon src={sparkleIcon} className={styles.tipIcon} />
            Tip: your employer badge renews automatically every 90 days while your work email stays
            active.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default EmployerStep
