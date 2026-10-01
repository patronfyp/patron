import { useEffect, useRef, useState } from 'react'

import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  getCurrentUser,
  linkedinAuthorize,
  login,
  refreshAccessToken,
  register,
  setRole,
} from '../api/auth.api'
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

// /auth/login only returns tokens, so the user's profile is fetched separately.
export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: async (payload) => {
      const { access_token: accessToken, refresh_token: refreshToken } = await login(payload)
      const user = await getCurrentUser(accessToken)
      setSession({ user, accessToken, refreshToken })
    },
  })
}

// Fetches the consent URL, then hands the browser off to LinkedIn entirely -
// there is nothing left to render once this resolves.
export function useLinkedInAuthorize() {
  return useMutation({
    mutationFn: async () => {
      const { authorize_url: authorizeUrl } = await linkedinAuthorize()
      window.location.href = authorizeUrl
    },
  })
}

// POST /auth/role - the step a LinkedIn sign-up needs before reaching the
// app (#25). Only the user record changes; the tokens already in the store
// are untouched.
export function useSetRole() {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: (role) => setRole(role),
    onSuccess: (user) => setUser(user),
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

  // StrictMode runs effects twice in development, but a refresh token is worth
  // exchanging once: with rotating refresh tokens the second call would be
  // refused and log the user out. A ref changes instantly, whereas state would
  // still read the old value when the effect runs the second time.
  const hasStarted = useRef(false)

  useEffect(() => {
    if (isReady || hasStarted.current) return
    hasStarted.current = true

    const { refreshToken, setAccessToken, clearSession } = useAuthStore.getState()

    refreshAccessToken(refreshToken)
      .then(({ access_token: accessToken }) => setAccessToken(accessToken))
      .catch(() => clearSession())
      .finally(() => setIsReady(true))
  }, [isReady])

  return isReady
}
