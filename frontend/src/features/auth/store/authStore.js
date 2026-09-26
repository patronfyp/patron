import { create } from 'zustand'

/**
 * Minimal session store — enough for ProtectedRoute to know whether a user is
 * signed in. #19 (Login page and auth store) extends this with `user` and the
 * real login/logout flow.
 */
export const useAuthStore = create((set) => ({
  accessToken: null,
  setSession: (accessToken) => set({ accessToken }),
  clearSession: () => set({ accessToken: null }),
}))
