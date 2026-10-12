import { useState } from 'react'

import { App, Button, Form, Input } from 'antd'
import { Link, useNavigate } from 'react-router-dom'

import AuthLayout from '../components/AuthLayout'
import RoleCards from '../components/RoleCards'
import { useRegister } from '../hooks/useAuth'

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
  // Outside the <Form>: Figma puts the role picker above the LinkedIn button,
  // and it always has a value (Candidate by default), so it needs no rules.
  const [role, setRole] = useState('candidate')

  const onFinish = (values) => {
    mutate(
      {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role,
      },
      {
        onSuccess: () => {
          message.success('Account created')
          navigate('/start', { replace: true })
        },
        onError: (error) => message.error(getErrorMessage(error)),
      },
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join PATRON and get referred by people who can vouch for you."
      quote="I signed up on a Monday. By Friday a LUMS alumnus at Garner had referred me."
      beforeLinkedIn={<RoleCards value={role} onChange={setRole} disabled={isPending} />}
      linkedInLabel="Sign up with LinkedIn"
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
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

        <Button type="primary" htmlType="submit" size="large" loading={isPending} block>
          Create account
        </Button>
      </Form>
    </AuthLayout>
  )
}

export default RegisterPage
