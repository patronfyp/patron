import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Picks the backend per write, based on the state being written: localStorage
// when `keepSignedIn` is true (survives closing the browser), sessionStorage
// when it's false (cleared then, but - like localStorage - still read back on
// an ordinary page refresh within the same tab, so ADR 0009's reason for
// persisting at all still holds either way). getItem checks both, since a
// session that started in one can still be read after `keepSignedIn` flips.
//
// `window.localStorage`/`window.sessionStorage`, not the bare globals: Node
// 22+ has its own experimental global `localStorage`, which can shadow the
// browser one. Wrapped in try/catch like roleMemory.js - private browsing or
// storage disabled shouldn't crash sign-in, only fall back to memory-only
// (the session won't survive a refresh, same as if this threw uncaught).
const sessionAwareStorage = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name) ?? window.sessionStorage.getItem(name)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      const raw = JSON.stringify(value)
      if (value.state.keepSignedIn) {
        window.sessionStorage.removeItem(name)
        window.localStorage.setItem(name, raw)
      } else {
        window.localStorage.removeItem(name)
        window.sessionStorage.setItem(name, raw)
      }
    } catch {
      // Nothing persisted - the session still works for this tab, in memory.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
      window.sessionStorage.removeItem(name)
    } catch {
      // Nothing to clean up if storage was never reachable.
    }
  },
}

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
      keepSignedIn: true,

      // `keepSignedIn` defaults to true so every caller that doesn't pass it
      // (register, the LinkedIn callback, a password change) keeps today's
      // behaviour - only LoginPage's "Keep me signed in" checkbox (#71) ever
      // passes false.
      setSession: ({ user, accessToken, refreshToken, keepSignedIn = true }) =>
        set({ user, accessToken, refreshToken, keepSignedIn }),
      // Used after a silent refresh, where only a new access token comes back.
      setAccessToken: (accessToken) => set({ accessToken }),
      // Used after POST /auth/role - only the user record changed, not the tokens.
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'patron-auth',
      storage: sessionAwareStorage,
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        keepSignedIn: state.keepSignedIn,
      }),
    },
  ),
)
