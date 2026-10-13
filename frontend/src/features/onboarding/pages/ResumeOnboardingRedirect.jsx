import { Flex, Spin } from 'antd'
import { Navigate } from 'react-router-dom'

import { useProfile } from '../hooks/useProfile'

/**
 * Where sign-in, sign-up and role selection land (`/start`): sends the user
 * back into onboarding at their saved step, or home once they have pressed
 * "Finish setup".
 *
 * Being on the last step is not finishing it - `onboarding_completed` is set
 * only by the Finish button (POST /profile/me/onboarding/complete). A profile
 * that cannot be loaded goes home rather than blocking sign-in on it.
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
