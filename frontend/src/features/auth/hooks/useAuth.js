import { useEffect, useRef, useState } from 'react'

import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  changePassword,
  confirmPasswordReset,
  getCurrentUser,
  linkedinAuthorize,
  login,
  refreshAccessToken,
  register,
  requestPasswordReset,
  setRole,
} from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

/**
 * Register, then log in with the same credentials - /register returns no tokens.
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

// Login returns only tokens, so the user is fetched after. `keepSignedIn` stays
// in the browser (authStore.js).
export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: async ({ keepSignedIn, ...payload }) => {
      const { access_token: accessToken, refresh_token: refreshToken } = await login(payload)
      const user = await getCurrentUser(accessToken)
      setSession({ user, accessToken, refreshToken, keepSignedIn })
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

// Adds a role - a LinkedIn sign-up's first one. Tokens are unchanged.
export function useSetRole() {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: (role) => setRole(role),
    onSuccess: (user) => setUser(user),
  })
}

// #50 always answers 202 whether or not the email has an account - this hook
// has nothing to branch on either, it just reports success or a real failure.
export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset })
}

// #50's /confirm sets the password and invalidates the token in one call -
// nothing in the store changes, the user still has to sign in afterwards.
export function useConfirmPasswordReset() {
  return useMutation({ mutationFn: confirmPasswordReset })
}

// A password change returns new tokens; only those are swapped in.
export function useChangePassword() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: (payload) => changePassword(payload),
    onSuccess: ({ access_token: accessToken, refresh_token: refreshToken }) => {
      setSession({ user: useAuthStore.getState().user, accessToken, refreshToken })
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
 * On app load, trade a saved refresh token for an access token (ADR 0009).
 * Returns false until that's done.
 */
export function useSessionBootstrap() {
  // No refresh token at all means there is nothing to wait for - decide that
  // synchronously so the effect below only ever runs for the async case.
  const [isReady, setIsReady] = useState(() => !useAuthStore.getState().refreshToken)

  // A ref, so StrictMode's second effect run doesn't refresh twice.
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
