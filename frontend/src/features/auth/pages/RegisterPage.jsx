import { App, Button, Flex, Form, Input, Select, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

import { useRegister } from '../hooks/useAuth'

const { Title, Paragraph } = Typography

const ROLE_OPTIONS = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'company', label: 'Company' },
  { value: 'both', label: 'Both' },
]

// A 422 from Pydantic carries an array of {msg}; our own errors carry a plain
// string - STANDARDS.md §4.7 says show the backend's reason, so handle both.
function getErrorMessage(error) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return 'Could not create your account. Please try again.'
}

function RegisterPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { mutate, isPending } = useRegister()

  const onFinish = (values) => {
    mutate(
      {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role: values.role,
      },
      {
        onSuccess: () => {
          message.success('Account created')
          navigate('/', { replace: true })
        },
        onError: (error) => message.error(getErrorMessage(error)),
      },
    )
  }

  return (
    <Flex vertical align="center" style={{ minHeight: '100%', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, marginTop: 48 }}>
        <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
          Register
        </Title>
        <Paragraph type="secondary">Create your Patron account.</Paragraph>

        <Form layout="vertical" onFinish={onFinish} disabled={isPending} autoComplete="off">
          <Form.Item
            name="fullName"
            label="Full name"
            rules={[{ required: true, message: 'Full name is required' }]}
          >
            <Input placeholder="Jane Doe" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email address' },
            ]}
          >
            <Input placeholder="jane@example.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Password is required' },
              { min: 8, message: 'At least 8 characters' },
            ]}
          >
            <Input.Password placeholder="At least 8 characters" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_rule, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Re-enter your password" />
          </Form.Item>

          <Form.Item
            name="role"
            label="I am a"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select placeholder="Select a role" options={ROLE_OPTIONS} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={isPending} block>
            Create account
          </Button>
        </Form>
      </div>
    </Flex>
  )
}

export default RegisterPage
