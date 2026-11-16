import { useEffect, useMemo, useRef, useState } from 'react'

import { App, Button, Col, Form, Input, Row, Segmented, Select } from 'antd'

import checkCircleIcon from '@/assets/icons/check-circle-16.svg'
import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import globeIcon from '@/assets/icons/globe.svg'
import layersIcon from '@/assets/icons/layers-16.svg'
import pinIcon from '@/assets/icons/pin.svg'
import uploadIcon from '@/assets/icons/upload.svg'
import {
  COMPANY_SIZES,
  HEADQUARTERS,
  INDUSTRIES,
  isOnDomain,
  useCreateOrJoinCompany,
  useRemoveCompanyLogo,
  useUpdateCompany,
  useUploadCompanyLogo,
  websiteDomain,
} from '@/features/companies'
import { fileUrl } from '@/shared/api/fileUrl'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'

import { useStepControls } from '../hooks/useStepControls'

import styles from './CompanyStep.module.css'
import EmailCodeVerification from './EmailCodeVerification'

// Wizard form field names - kept apart from the profile fields PATCH /profile/me takes.
const FIELDS = ['company_name', 'company_website', 'company_size', 'company_industry', 'company_hq']

/**
 * The recruiter's step 2 - their company (Figma 67:899). Continue creates the
 * company, or joins it if its domain is already on PATRON (ADR 0020).
 *
 * @param {object} props
 * @param {import('@/features/companies/api/companies.api').Company | null} props.company
 *   - the user's company, when they already have one
 * @param {string | null} props.verifiedEmail - the latest verified work email
 */
function CompanyStep({ company, verifiedEmail }) {
  const { message } = App.useApp()
  const form = Form.useFormInstance()
  const fileInput = useRef(null)
  const [pendingLogo, setPendingLogo] = useState(null)
  const [proofError, setProofError] = useState(null)

  const createOrJoin = useCreateOrJoinCompany()
  const update = useUpdateCompany()
  const uploadLogo = useUploadCompanyLogo()
  const removeLogo = useRemoveCompanyLogo()

  const name = Form.useWatch('company_name') ?? ''
  const domain = websiteDomain(Form.useWatch('company_website'))
  const isVerified = isOnDomain(verifiedEmail, domain)

  const preview = useMemo(
    () => (pendingLogo ? URL.createObjectURL(pendingLogo) : null),
    [pendingLogo],
  )
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])
  const logo = preview ?? fileUrl(company?.logo_url)

  useStepControls({
    beforeContinue: async () => {
      let values
      try {
        values = await form.validateFields(FIELDS)
      } catch {
        return false // antd shows the field errors
      }
      if (!isVerified) {
        setProofError(`Verify an email at @${domain} to continue.`)
        return false
      }
      const details = {
        name: values.company_name,
        size: values.company_size,
        industry: values.company_industry,
        headquarters: values.company_hq,
      }
      try {
        if (company) await update.mutateAsync(details)
        else await createOrJoin.mutateAsync({ ...details, website: values.company_website })
        if (pendingLogo) await uploadLogo.mutateAsync(pendingLogo)
        return true
      } catch (error) {
        message.error(getApiErrorMessage(error, 'Could not save your company. Please try again.'))
        return false
      }
    },
  })

  function handleLogoPicked(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // so picking the same file again still fires
    if (file) setPendingLogo(file)
  }

  function handleRemoveLogo() {
    if (pendingLogo) setPendingLogo(null)
    else removeLogo.mutate()
  }

  return (
    <div className={styles.fields}>
      <div className={styles.logoRow}>
        <span className={styles.logo}>
          {logo ? <img src={logo} alt={`${name} logo`} /> : (name.trim()[0] ?? '?').toLowerCase()}
        </span>
        <div className={styles.logoActions}>
          <div className={styles.logoButtons}>
            <Button
              size="small"
              className={styles.uploadButton}
              onClick={() => fileInput.current?.click()}
            >
              <Icon src={uploadIcon} size={14} />
              Upload logo
            </Button>
            {logo ? (
              <Button
                type="text"
                size="small"
                className={styles.ghost}
                onClick={handleRemoveLogo}
                loading={removeLogo.isPending}
              >
                Remove
              </Button>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              className={styles.fileInput}
              onChange={handleLogoPicked}
              aria-label="Company logo"
            />
          </div>
          <span className={styles.hint}>Square PNG or JPG. Shown on every job and referral.</span>
        </div>
      </div>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="company_name"
            label="Company name"
            initialValue={company?.name}
            rules={[{ required: true, whitespace: true, message: 'Enter your company name' }]}
          >
            <Input placeholder="e.g. Garner" maxLength={200} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="company_website"
            label="Website"
            initialValue={company?.domain ?? verifiedEmail?.split('@')[1]}
            rules={[
              { required: true, message: 'Enter your company website' },
              {
                pattern: /^(https?:\/\/)?(www\.)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i,
                message: 'Enter a website like garner.com',
              },
            ]}
            extra={isVerified ? `Domain verified from ${verifiedEmail}` : null}
          >
            <Input
              placeholder="garner.com"
              maxLength={255}
              disabled={Boolean(company)}
              prefix={<Icon src={globeIcon} className={styles.fieldIcon} />}
              suffix={
                isVerified ? <Icon src={checkCircleIcon} className={styles.validIcon} /> : <span />
              }
            />
          </Form.Item>
        </Col>
      </Row>

      {domain && !isVerified ? (
        <div className={styles.verify}>
          <EmailCodeVerification
            // A fresh form per domain, so a code sent for one isn't reused.
            key={domain}
            kind="employer"
            label={`Work email at ${domain}`}
            placeholder={`you@${domain}`}
            helpText="We confirm recruiters through their company domain, so every job on PATRON is real."
          />
          {proofError ? (
            <p className={styles.error} role="alert">
              {proofError}
            </p>
          ) : null}
        </div>
      ) : null}

      <Form.Item
        name="company_size"
        label="Company size"
        initialValue={company?.size}
        rules={[{ required: true, message: 'Pick your company size' }]}
      >
        <Segmented options={COMPANY_SIZES} className={styles.segmented} />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="company_industry"
            label="Industry"
            initialValue={company?.industry}
            rules={[{ required: true, message: 'Pick your industry' }]}
          >
            <Select
              placeholder="Select an industry"
              options={INDUSTRIES}
              prefix={<Icon src={layersIcon} className={styles.fieldIcon} />}
              suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="company_hq"
            label="Headquarters"
            initialValue={company?.headquarters}
            rules={[{ required: true, message: 'Pick your headquarters' }]}
          >
            <Select
              showSearch
              placeholder="Select a city"
              options={HEADQUARTERS}
              prefix={<Icon src={pinIcon} className={styles.fieldIcon} />}
              suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
            />
          </Form.Item>
        </Col>
      </Row>
    </div>
  )
}

export default CompanyStep
