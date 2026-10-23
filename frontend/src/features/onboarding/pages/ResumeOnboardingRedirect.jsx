import { Flex, Spin } from 'antd'
import { Navigate } from 'react-router-dom'

import { useProfile } from '../hooks/useProfile'

/**
 * `/start`: back into onboarding, or home once "Finish setup" was pressed.
 * A profile that won't load goes home.
 */
function ResumeOnboardingRedirect() {
  const { data: profile, isPending, isError } = useProfile()

  if (isPending) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    )
  }

  const isUnfinished = !isError && !profile.onboarding_completed
  return <Navigate to={isUnfinished ? '/onboarding' : '/'} replace />
}

export default ResumeOnboardingRedirect
