import { useMutation } from '@tanstack/react-query'

import { login, register } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

/**
 * Registers the account, then immediately logs in with the same credentials
 * so the user lands signed in - /register returns no tokens, only /login does.
 */
export function useRegister() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: async (payload) => {
      await register(payload)
      const { access_token: accessToken } = await login({
        email: payload.email,
        password: payload.password,
      })
      setSession(accessToken)
    },
  })
}
