import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Session store - see docs/adr/0009-access-token-in-memory-refresh-token-in-localstorage.md
 * for why the split is this way: `accessToken` never leaves memory (not even
 * this middleware persists it); `user` and `refreshToken` are persisted so a
 * page refresh doesn't sign the user out.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      // Used after a silent refresh, where only a new access token comes back.
      setAccessToken: (accessToken) => set({ accessToken }),
      // Used after POST /auth/role - only the user record changed, not the tokens.
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'patron-auth',
      partialize: (state) => ({ user: state.user, refreshToken: state.refreshToken }),
    },
  ),
)
