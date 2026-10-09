import { Col, Form, Input, Row, Select } from 'antd'

import OptionCards from './OptionCards'

// Placeholder data: there is no university lookup API yet, so the list is a
// fixed set of Pakistani universities until the backend provides one.
const UNIVERSITIES = [
  'Lahore University of Management Sciences (LUMS)',
  'National University of Sciences and Technology (NUST)',
  'FAST National University of Computer and Emerging Sciences',
  'COMSATS University Islamabad',
  'University of Engineering and Technology (UET) Lahore',
  'Ghulam Ishaq Khan Institute (GIKI)',
  'Institute of Business Administration (IBA) Karachi',
  'University of the Punjab',
  'Quaid-i-Azam University',
  'Habib University',
  'Aga Khan University',
  'NED University of Engineering and Technology',
].map((name) => ({ value: name, label: name }))

// The backend accepts 1950 up to eight years ahead (profiles/schemas.py).
const FIRST_YEAR = 1950
const LAST_YEAR = new Date().getFullYear() + 8
const GRADUATION_YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, index) => {
  const year = LAST_YEAR - index
  return { value: year, label: String(year) }
})

// UI only for now: verifying the degree is #52's work, and the profile has no
// field for the chosen method, so it is not sent to the backend.
const VERIFICATION_METHODS = [
  {
    value: 'university_email',
    title: 'University email',
    badge: 'Fastest',
    description: 'We send a code to your edu.pk address and that is it.',
  },
  {
    value: 'registrar_record',
    title: 'Registrar record',
    description: 'Upload your transcript or degree. Reviewed within 24 hours.',
  },
]

function UniversityStep() {
  return (
    <>
      <Form.Item
        name="university"
        label="University"
        rules={[{ required: true, message: 'Select your university' }]}
      >
        <Select showSearch placeholder="Search for your university" options={UNIVERSITIES} />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={14}>
          <Form.Item
            name="degree"
            label="Degree"
            rules={[{ required: true, message: 'Enter your degree' }]}
          >
            <Input placeholder="e.g. BSc Computer Science" maxLength={150} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={10}>
          <Form.Item
            name="graduation_year"
            label="Graduation year"
            rules={[{ required: true, message: 'Select your graduation year' }]}
          >
            <Select showSearch placeholder="Year" options={GRADUATION_YEARS} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="verification_method"
        label="Verification method"
        initialValue="university_email"
        rules={[{ required: true, message: 'Choose how to verify your degree' }]}
      >
        <OptionCards name="verification_method" options={VERIFICATION_METHODS} />
      </Form.Item>
    </>
  )
}

export default UniversityStep
