import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { login } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

/**
 * /auth/login only returns tokens, not the user's profile (there is no "me"
 * endpoint yet), so `user` stays null here. Register's flow can do better
 * because /auth/register itself returns the created user.
 */
export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: async (payload) => {
      const { access_token: accessToken, refresh_token: refreshToken } = await login(payload)
      setSession({ user: null, accessToken, refreshToken })
    },
  })
}

// Logout is local only - the backend has no session to invalidate (stateless JWTs).
export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession)
  const navigate = useNavigate()

  return () => {
    clearSession()
    navigate('/login', { replace: true })
  }
}
