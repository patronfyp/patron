import { useState } from 'react'

import { App, Button, Form, Input } from 'antd'
import { Link } from 'react-router-dom'

import AuthLayout from '../components/AuthLayout'
import { useRequestPasswordReset } from '../hooks/useAuth'

// A 422 from Pydantic carries an array of {msg}; our own errors carry a plain
// string - STANDARDS.md §4.7 says show the backend's reason, so handle both.
function getErrorMessage(error) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return 'Could not send the reset email. Please try again.'
}

function ForgotPasswordPage() {
  const { message } = App.useApp()
  const { mutate, isPending } = useRequestPasswordReset()
  const [isSent, setIsSent] = useState(false)

  const onFinish = (values) => {
    mutate(
      { email: values.email },
      {
        // The backend answers 202 whether or not the account exists (#50) -
        // showing the same message either way is the point, not a detail to
        // branch on.
        onSuccess: () => setIsSent(true),
        onError: (error) => message.error(getErrorMessage(error)),
      },
    )
  }

  if (isSent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="If that account exists, we've emailed a link to reset your password."
      >
        <Link to="/login">Back to sign in</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
    >
      <Form layout="vertical" onFinish={onFinish} disabled={isPending} autoComplete="off">
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

        <Button type="primary" htmlType="submit" loading={isPending} block>
          Send reset link
        </Button>
      </Form>
    </AuthLayout>
  )
}

export default ForgotPasswordPage
