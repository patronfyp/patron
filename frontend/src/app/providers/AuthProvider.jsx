import { Flex, Spin } from 'antd'

import { useSessionBootstrap } from '@/features/auth'

/**
 * Waits for the silent session refresh (ADR 0009) before rendering routes,
 * so a valid session never flashes a redirect to /login.
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
