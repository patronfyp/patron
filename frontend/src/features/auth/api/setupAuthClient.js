import { configureAuthClient } from '@/shared/api/client'

import { useAuthStore } from '../store/authStore'

import { refreshAccessToken } from './auth.api'

/** Connects the shared API client to this feature's session. Call once at startup. */
export function setupAuthClient() {
  configureAuthClient({
    getAccessToken: () => useAuthStore.getState().accessToken,

    refresh: async () => {
      const { refreshToken, setAccessToken } = useAuthStore.getState()
      if (!refreshToken) throw new Error('No refresh token to exchange')

      const { access_token: accessToken } = await refreshAccessToken(refreshToken)
      setAccessToken(accessToken)
      return accessToken
    },

    // ProtectedRoute watches the store, so clearing it is what sends the user to /login.
    onAuthFailure: () => useAuthStore.getState().clearSession(),
  })
}
