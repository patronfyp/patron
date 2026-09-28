import { App, Button, Form, Input } from 'antd'
import { useNavigate } from 'react-router-dom'

import AuthLayout from '../components/AuthLayout'
import { useLogin } from '../hooks/useAuth'

// A 422 from Pydantic carries an array of {msg}; our own errors carry a plain
// string - STANDARDS.md §4.7 says show the backend's reason, so handle both.
function getErrorMessage(error) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return 'Could not log in. Please try again.'
}

function LoginPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { mutate, isPending } = useLogin()

  const onFinish = (values) => {
    mutate(
      { email: values.email, password: values.password },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: (error) => message.error(getErrorMessage(error)),
      },
    )
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Patron account.">
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

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Password is required' }]}
        >
          <Input.Password placeholder="Your password" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={isPending} block>
          Log in
        </Button>
      </Form>
    </AuthLayout>
  )
}

export default LoginPage
