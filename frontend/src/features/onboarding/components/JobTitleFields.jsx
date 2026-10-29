import { Col, Form, Input, Row } from 'antd'

/** Job title (required) and team, side by side (Figma 67:505). */
function JobTitleFields() {
  return (
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
  )
}

export default JobTitleFields
