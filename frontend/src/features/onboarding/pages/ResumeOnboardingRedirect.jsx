import { Flex, Spin } from 'antd'
import { Navigate } from 'react-router-dom'

import { useProfile } from '../hooks/useProfile'
import { STEPS } from '../steps'

/**
 * Where sign-in, sign-up and role selection land (`/start`): sends the user
 * back into onboarding at their saved step, or home if they are past it.
 *
 * "Past it" means the profile's step reached the last one - the backend has
 * no separate completed flag yet. A profile that cannot be loaded goes home
 * rather than blocking sign-in on it.
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

  const isUnfinished = !isError && profile.onboarding_step < STEPS.length
  return <Navigate to={isUnfinished ? '/onboarding' : '/'} replace />
}

export default ResumeOnboardingRedirect
