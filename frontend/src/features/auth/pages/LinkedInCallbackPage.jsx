import { useEffect, useRef } from 'react'

import { App, Flex, Spin, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

import { getCurrentUser } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

const { Paragraph } = Typography

const GENERIC_FAILURE = 'Could not sign in with LinkedIn. Please try again.'

/**
 * Where /auth/linkedin/callback (the backend route) sends the browser on
 * success - tokens arrive in the URL fragment, never the query string, so
 * they never reach server logs or a Referer header (see router.py).
 *
 * A ref guards against StrictMode's double-invoked effect running this
 * twice in development - see useSessionBootstrap for the same pattern.
 */
function LinkedInCallbackPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      message.error(GENERIC_FAILURE)
      navigate('/login', { replace: true })
      return
    }

    getCurrentUser(accessToken)
      .then((user) => {
        setSession({ user, accessToken, refreshToken })
        navigate('/start', { replace: true })
      })
      .catch(() => {
        message.error(GENERIC_FAILURE)
        navigate('/login', { replace: true })
      })
  }, [message, navigate, setSession])

  return (
    <Flex
      vertical
      align="center"
      justify="center"
      gap={16}
      style={{ minHeight: '100%', padding: 24 }}
    >
      <Spin size="large" />
      <Paragraph type="secondary">Signing you in with LinkedIn...</Paragraph>
    </Flex>
  )
}

export default LinkedInCallbackPage
