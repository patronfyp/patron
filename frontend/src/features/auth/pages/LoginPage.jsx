import { useEffect, useRef } from 'react'

import { App, Button, Form, Input } from 'antd'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

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
  const location = useLocation()
  const { mutate, isPending } = useLogin()
  const [searchParams, setSearchParams] = useSearchParams()
  // StrictMode double-invokes this effect in development; clearing the query
  // param doesn't take effect before the second run reads it again, which
  // would show the message twice - see LinkedInCallbackPage for the same
  // pattern.
  const hasShownLinkedinError = useRef(false)
  const hasShownResetSuccess = useRef(false)

  // /auth/linkedin/callback (the backend route) redirects failures here as
  // ?linkedin_error=<message> rather than a raw JSON page - see router.py.
  useEffect(() => {
    const linkedinError = searchParams.get('linkedin_error')
    if (!linkedinError || hasShownLinkedinError.current) return
    hasShownLinkedinError.current = true

    message.error(linkedinError)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, message])

  // ResetPasswordPage lands here with this flag in router state (#53) rather
  // than a query param - there is nothing left to clean up in the URL.
  useEffect(() => {
    if (!location.state?.passwordWasReset || hasShownResetSuccess.current) return
    hasShownResetSuccess.current = true

    message.success('Your password has been reset. Please sign in.')
  }, [location.state, message])

  const onFinish = (values) => {
    mutate(
      { email: values.email, password: values.password },
      {
        onSuccess: () => navigate('/start', { replace: true }),
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

        <div style={{ textAlign: 'right', marginTop: -12, marginBottom: 16 }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <Button type="primary" htmlType="submit" loading={isPending} block>
          Log in
        </Button>
      </Form>
    </AuthLayout>
  )
}

export default LoginPage
