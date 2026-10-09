import { Form, Input, Select } from 'antd'

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

// Placeholder code: emailing and checking it is #52's work. Not sent to the
// backend - only the profile fields are saved.
const DUMMY_OTP = '481920'

/**
 * @param {object} props
 * @param {boolean} props.isRequired - false for candidates, who may skip this step
 */
function EmployerStep({ isRequired }) {
  const employerName = Form.useWatch('employer_name')
  const company = COMPANIES.find((item) => item.name === employerName)

  return (
    <>
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
        />
      </Form.Item>

      {company ? (
        <>
          <div className={styles.company}>
            <span className={styles.logo} aria-hidden="true">
              {company.name.charAt(0)}
            </span>
            <span className={styles.companyText}>
              <span className={styles.companyName}>{company.name}</span>
              <span className={styles.companyMeta}>
                {company.domain} &middot; {company.size}
              </span>
            </span>
            <span className={styles.matched}>Domain matched</span>
          </div>

          <Form.Item
            name="employer_otp"
            label={`Enter the 6-digit code sent to your @${company.domain} email`}
            initialValue={DUMMY_OTP}
            extra="Didn't get it? Resend in 0:42"
          >
            <Input.OTP length={6} />
          </Form.Item>

          <p className={styles.tip}>
            Tip: your employer badge renews automatically every 90 days while your work email stays
            active.
          </p>
        </>
      ) : null}
    </>
  )
}

export default EmployerStep
