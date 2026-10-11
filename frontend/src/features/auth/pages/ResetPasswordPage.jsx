import { App, Button, Form, Input } from 'antd'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import AuthLayout from '../components/AuthLayout'
import { useConfirmPasswordReset } from '../hooks/useAuth'

// A 422 from Pydantic carries an array of {msg}; our own errors carry a plain
// string - STANDARDS.md §4.7 says show the backend's reason, so handle both.
function getErrorMessage(error) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return 'Could not reset your password. Please try again.'
}

function ExpiredLink() {
  return (
    <AuthLayout
      title="This link no longer works"
      subtitle="Reset links expire after 30 minutes and can only be used once."
    >
      <Link to="/forgot-password">Request a new link</Link>
    </AuthLayout>
  )
}

function ResetPasswordPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { mutate, isPending, isError, error } = useConfirmPasswordReset()

  const onFinish = (values) => {
    mutate(
      { token, newPassword: values.password },
      {
        onSuccess: () => navigate('/login', { replace: true, state: { passwordWasReset: true } }),
        onError: (err) => {
          // A 400 here only ever means the token is unknown, expired or
          // already used (#50) - that case renders its own screen below
          // instead of a toast. Anything else (a weak password, etc.) is a
          // real form error.
          if (err.response?.status !== 400) message.error(getErrorMessage(err))
        },
      },
    )
  }

  if (!token || (isError && error.response?.status === 400)) {
    return <ExpiredLink />
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a new password for your account.">
      <Form layout="vertical" onFinish={onFinish} disabled={isPending} autoComplete="off">
        <Form.Item
          name="password"
          label="New password"
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
          <Input.Password placeholder="Re-enter your new password" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={isPending} block>
          Reset password
        </Button>
      </Form>
    </AuthLayout>
  )
}

export default ResetPasswordPage
