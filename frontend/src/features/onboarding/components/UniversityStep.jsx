import { useRef } from 'react'

import { App, Button, Col, Form, Input, Row, Select } from 'antd'

import capIcon from '@/assets/icons/cap-16.svg'
import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import fileIcon from '@/assets/icons/file-18.svg'
import mailIcon from '@/assets/icons/mail-18.svg'
import { useUploadVerificationDocument } from '@/features/verification'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'

import EmailCodeVerification from './EmailCodeVerification'
import OptionCards from './OptionCards'
import styles from './UniversityStep.module.css'

// No university lookup API yet. `domain` is set only for universities the
// backend can verify by email - the names and domains must match
// UNIVERSITY_DOMAINS in backend/app/modules/verification/service.py exactly,
// or the code is refused. The rest go through the registrar record.
const UNIVERSITIES = [
  { name: 'Lahore University of Management Sciences (LUMS)', domain: 'lums.edu.pk' },
  { name: 'National University of Sciences and Technology (NUST)', domain: 'nust.edu.pk' },
  {
    name: 'FAST National University of Computer and Emerging Sciences (FAST-NUCES)',
    domain: 'nu.edu.pk',
  },
  { name: 'COMSATS University Islamabad', domain: 'comsats.edu.pk' },
  { name: 'University of Engineering and Technology (UET) Lahore', domain: 'uet.edu.pk' },
  { name: 'Information Technology University (ITU)', domain: 'itu.edu.pk' },
  { name: 'Ghulam Ishaq Khan Institute (GIKI)' },
  { name: 'Institute of Business Administration (IBA) Karachi' },
  { name: 'University of the Punjab' },
  { name: 'Quaid-i-Azam University' },
  { name: 'Habib University' },
  { name: 'Aga Khan University' },
  { name: 'NED University of Engineering and Technology' },
]

const UNIVERSITY_OPTIONS = UNIVERSITIES.map(({ name }) => ({ value: name, label: name }))

// The backend accepts 1950 up to eight years ahead (profiles/schemas.py).
const FIRST_YEAR = 1950
const LAST_YEAR = new Date().getFullYear() + 8
const GRADUATION_YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, index) => {
  const year = LAST_YEAR - index
  return { value: year, label: String(year) }
})

function DocumentUpload() {
  const { message } = App.useApp()
  const fileInput = useRef(null)
  const upload = useUploadVerificationDocument()

  function handlePicked(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    upload.mutate(
      { kind: 'university', file },
      {
        onError: (error) =>
          message.error(getApiErrorMessage(error, 'Could not upload the file. Please try again.')),
      },
    )
  }

  if (upload.data) {
    return (
      <p className={styles.pending}>
        <strong>{upload.data.filename}</strong> is uploaded and waiting for review.
      </p>
    )
  }

  return (
    <div className={styles.upload}>
      <Button onClick={() => fileInput.current?.click()} loading={upload.isPending}>
        Upload transcript or degree
      </Button>
      <span className={styles.hint}>PDF, JPG or PNG, up to 5 MB.</span>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className={styles.fileInput}
        onChange={handlePicked}
        aria-label="Transcript or degree"
      />
    </div>
  )
}

/**
 * Step 3 - university, degree, year and how to verify it (Figma 9:203).
 *
 * @param {object} props
 * @param {string} [props.defaultEmail] - the sign-up email, if the user chose
 *   to reuse it on the Account step
 * @param {string | null} [props.verifiedEmail] - a university email already verified
 * @param {boolean} [props.hasPendingDocument] - a registrar record is already uploaded
 */
function UniversityStep({ defaultEmail, verifiedEmail, hasPendingDocument }) {
  const university = Form.useWatch('university')
  const verificationMethod = Form.useWatch('verification_method')
  const domain = UNIVERSITIES.find((item) => item.name === university)?.domain

  const methods = [
    {
      value: 'university_email',
      title: 'University email',
      badge: 'Fastest',
      description: domain
        ? `We send a code to your @${domain} address.`
        : "Your university can't be verified by email yet - use the registrar record.",
      icon: mailIcon,
    },
    {
      value: 'registrar_record',
      title: 'Registrar record',
      description: 'Upload your transcript or degree. Reviewed within 24 hours.',
      icon: fileIcon,
    },
  ]

  return (
    <div className={styles.fields}>
      <Form.Item
        name="university"
        label="University"
        rules={[{ required: true, message: 'Select your university' }]}
      >
        <Select
          showSearch
          placeholder="Search for your university"
          options={UNIVERSITY_OPTIONS}
          prefix={<Icon src={capIcon} className={styles.fieldIcon} />}
          suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
        />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="degree"
            label="Degree"
            rules={[{ required: true, message: 'Enter your degree' }]}
          >
            <Input placeholder="e.g. BSc Computer Science" maxLength={150} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="graduation_year"
            label="Graduation year"
            rules={[{ required: true, message: 'Select your graduation year' }]}
          >
            <Select
              showSearch
              placeholder="Year"
              options={GRADUATION_YEARS}
              suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="verification_method"
        label="Verification method"
        initialValue={hasPendingDocument ? 'registrar_record' : 'university_email'}
      >
        <OptionCards name="verification_method" options={methods} />
      </Form.Item>

      {verificationMethod === 'university_email' && domain ? (
        <EmailCodeVerification
          kind="university"
          label="University email"
          placeholder={`you@${domain}`}
          helpText="Use the email address your university issued you."
          defaultEmail={defaultEmail?.endsWith(domain) ? defaultEmail : ''}
          verifiedEmail={verifiedEmail}
        />
      ) : null}

      {verificationMethod === 'registrar_record' ? (
        hasPendingDocument ? (
          <p className={styles.pending}>Your document is uploaded and waiting for review.</p>
        ) : (
          <DocumentUpload />
        )
      ) : null}
    </div>
  )
}

export default UniversityStep
