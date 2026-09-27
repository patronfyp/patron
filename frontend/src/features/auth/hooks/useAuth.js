import { useEffect, useState } from 'react'

import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { login, refreshAccessToken, register } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

/**
 * Registers the account, then immediately logs in with the same credentials
 * so the user lands signed in - /register returns no tokens, only /login does.
 * /register does return the created user, so that's used directly instead of
 * an extra /auth/me call.
 */
export function useRegister() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: async (payload) => {
      const user = await register(payload)
      const { access_token: accessToken, refresh_token: refreshToken } = await login({
        email: payload.email,
        password: payload.password,
      })
      setSession({ user, accessToken, refreshToken })
    },
  })
}

/**
 * /auth/login only returns tokens, not the user's profile, so `user` stays
 * null here. Fetching it would mean an extra /auth/me call - not done yet,
 * see the note left for the team on this PR.
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

/**
 * Runs once on app load. The access token never survives a refresh (ADR 0009),
 * so if a refresh token was persisted, silently exchange it for a new access
 * token before any protected route renders. Returns false while that check is
 * still in flight.
 */
export function useSessionBootstrap() {
  // No refresh token at all means there is nothing to wait for - decide that
  // synchronously so the effect below only ever runs for the async case.
  const [isReady, setIsReady] = useState(() => !useAuthStore.getState().refreshToken)

  useEffect(() => {
    if (isReady) return

    const { refreshToken, setAccessToken, clearSession } = useAuthStore.getState()

    refreshAccessToken(refreshToken)
      .then(({ access_token: accessToken }) => setAccessToken(accessToken))
      .catch(() => clearSession())
      .finally(() => setIsReady(true))
  }, [isReady])

  return isReady
}
