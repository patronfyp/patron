import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from './authStore'

const STORAGE_KEY = 'patron-auth'

// Some CI/local environments' jsdom doesn't implement localStorage at all
// (Node's own global can shadow it) - clearing is best-effort, same as
// authStore.js's own storage wrapper.
function clearBrowserStorage() {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // Nothing to clear if storage was never reachable.
  }
}

describe('useAuthStore - keep me signed in (#71)', () => {
  beforeEach(clearBrowserStorage)

  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, keepSignedIn: true })
    clearBrowserStorage()
  })

  it('persists to localStorage when keepSignedIn is true', () => {
    useAuthStore.getState().setSession({
      user: { id: 1 },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      keepSignedIn: true,
    })

    expect(localStorage.getItem(STORAGE_KEY)).toContain('refresh-1')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('persists to sessionStorage, not localStorage, when keepSignedIn is false', () => {
    useAuthStore.getState().setSession({
      user: { id: 1 },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      keepSignedIn: false,
    })

    expect(sessionStorage.getItem(STORAGE_KEY)).toContain('refresh-1')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('defaults keepSignedIn to true for callers that never pass it (register, LinkedIn, ...)', () => {
    useAuthStore.getState().setSession({
      user: { id: 1 },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    })

    expect(localStorage.getItem(STORAGE_KEY)).toContain('refresh-1')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clears both storages on logout', () => {
    useAuthStore.getState().setSession({
      user: { id: 1 },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      keepSignedIn: false,
    })

    useAuthStore.getState().clearSession()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
