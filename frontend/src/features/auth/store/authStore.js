import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// "Keep me signed in" on: localStorage (survives closing the browser);
// off: sessionStorage. `window.` because Node 22+ has its own localStorage.
// Blocked storage falls back to memory instead of crashing sign-in.
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
 * Session store. The access token stays in memory; user and refresh token are
 * persisted so a refresh keeps you signed in (ADR 0009).
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      keepSignedIn: true,

      // Only LoginPage's checkbox ever passes false.
      setSession: ({ user, accessToken, refreshToken, keepSignedIn = true }) =>
        set({ user, accessToken, refreshToken, keepSignedIn }),
      // Used after a silent refresh, where only a new access token comes back.
      setAccessToken: (accessToken) => set({ accessToken }),
      // Used after POST /auth/role - only the user record changed, not the tokens.
      setUser: (user) => set({ user }),
      // persist never removes its key, so clear it explicitly.
      clearSession: () => {
        set({ user: null, accessToken: null, refreshToken: null, keepSignedIn: true })
        useAuthStore.persist.clearStorage()
      },
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
