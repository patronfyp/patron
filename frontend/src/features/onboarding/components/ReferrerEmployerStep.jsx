import { useState } from 'react'

import { Col, Form, Input, Row, Select } from 'antd'

import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import fileIcon from '@/assets/icons/file-18.svg'
import mailIcon from '@/assets/icons/mail-18.svg'
import Icon from '@/shared/components/Icon/Icon'

import { useStepControls } from '../hooks/useStepControls'
import { COMPANY_OPTIONS, findCompany } from '../lib/companies'

import DocumentUpload from './DocumentUpload'
import EmailCodeVerification from './EmailCodeVerification'
import OptionCards from './OptionCards'
import styles from './ReferrerEmployerStep.module.css'

/** A company as Figma's company field shows it: logo tile, name, details. */
function CompanyLabel({ name }) {
  const company = findCompany(name)
  return (
    <span className={styles.company}>
      {/* No company logos yet - the initial stands in. */}
      <span className={styles.logo} aria-hidden="true">
        {name.charAt(0).toLowerCase()}
      </span>
      <span className={styles.companyText}>
        <span className={styles.companyName}>{name}</span>
        {company ? (
          <span className={styles.companyMeta}>
            {company.domain} &middot; {company.size}
          </span>
        ) : null}
      </span>
    </span>
  )
}

/** True when `email` is on the company's domain or one of its subdomains. */
function isCompanyEmail(email, company) {
  const domain = email?.toLowerCase().split('@')[1]
  return Boolean(domain && (domain === company.domain || domain.endsWith(`.${company.domain}`)))
}

/**
 * The referrer's step 2 - where they work and how to prove it (Figma 67:505).
 * Figma's second option, "LinkedIn current position", is an employment letter
 * here: LinkedIn's self-serve API doesn't return positions (ADR 0013).
 *
 * A referrer can't move on without proof - a work email at the chosen company
 * or an employment letter waiting for review. The backend checks the same
 * before it lets them finish.
 *
 * @param {object} props
 * @param {string | null} [props.verifiedEmail] - a work email already verified
 * @param {boolean} [props.hasPendingDocument] - an employment letter is already uploaded
 */
function ReferrerEmployerStep({ verifiedEmail, hasPendingDocument }) {
  const company = findCompany(Form.useWatch('employer_name'))
  const method = Form.useWatch('employer_verification_method')
  const [proofError, setProofError] = useState(null)

  // A work email verified for a different company proves nothing here.
  const companyEmail = company && isCompanyEmail(verifiedEmail, company) ? verifiedEmail : null
  const hasProof = Boolean(companyEmail) || hasPendingDocument

  useStepControls({
    beforeContinue: async () => {
      // No company yet: let the form's own "Select the company" error show.
      if (!company || hasProof) return true
      setProofError('Verify your work email or upload an employment letter to continue.')
      return false
    },
  })

  const methods = [
    {
      value: 'work_email',
      title: 'Work email',
      badge: 'Instant',
      description: company
        ? `We send a code to your @${company.domain} address.`
        : 'We send a code to your work email.',
      icon: mailIcon,
    },
    {
      value: 'employment_letter',
      title: 'Employment letter',
      description: 'Upload a letter from your employer. Reviewed within 24 hours.',
      icon: fileIcon,
    },
  ]

  return (
    <div className={styles.fields}>
      <Form.Item
        name="employer_name"
        label="Where do you work?"
        rules={[{ required: true, message: 'Select the company you work at' }]}
      >
        <Select
          showSearch
          placeholder="Search for your company"
          options={COMPANY_OPTIONS}
          className={styles.companySelect}
          labelRender={({ value }) => <CompanyLabel name={value} />}
          suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
        />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="job_title"
            label="Job title"
            rules={[{ required: true, message: 'Enter your job title' }]}
          >
            <Input placeholder="e.g. Senior Software Engineer" maxLength={150} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="team" label="Team">
            <Input placeholder="e.g. Payments Platform" maxLength={100} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="employer_verification_method"
        label="How should we verify you?"
        initialValue={hasPendingDocument ? 'employment_letter' : 'work_email'}
      >
        <OptionCards name="employer_verification_method" options={methods} />
      </Form.Item>

      {method === 'work_email' ? (
        <EmailCodeVerification
          // A fresh form per company, so a code sent for one isn't reused.
          key={company?.name ?? 'none'}
          kind="employer"
          label="Work email"
          placeholder={company ? `you@${company.domain}` : 'you@company.com'}
          helpText={
            company
              ? `Use your @${company.domain} address. Personal emails like Gmail cannot verify an employer.`
              : 'Personal emails like Gmail cannot verify an employer.'
          }
          verifiedEmail={companyEmail}
        />
      ) : null}

      {method === 'employment_letter' ? (
        <DocumentUpload
          kind="employer"
          buttonLabel="Upload employment letter"
          inputLabel="Employment letter"
          hasPendingDocument={hasPendingDocument}
        />
      ) : null}

      {proofError && !hasProof ? (
        <p className={styles.error} role="alert">
          {proofError}
        </p>
      ) : null}
    </div>
  )
}

export default ReferrerEmployerStep
