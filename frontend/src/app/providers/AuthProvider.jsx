import { Flex, Spin } from 'antd'

import { useSessionBootstrap } from '@/features/auth'

/**
 * Blocks rendering the router until useSessionBootstrap's silent refresh
 * (ADR 0009) has resolved, so a protected route never flashes a redirect to
 * /login before a valid session has had a chance to restore itself.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 */
function AuthProvider({ children }) {
  const isReady = useSessionBootstrap()

  if (!isReady) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    )
  }

  return children
}

export default AuthProvider
