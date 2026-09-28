import { configureAuthClient } from '@/shared/api/client'

import { useAuthStore } from '../store/authStore'

/** Connects the shared API client to this feature's session. Call once at startup. */
export function setupAuthClient() {
  configureAuthClient({
    getAccessToken: () => useAuthStore.getState().accessToken,
  })
}
