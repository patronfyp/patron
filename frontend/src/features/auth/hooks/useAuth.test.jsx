import { StrictMode } from 'react'

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshAccessToken } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

import { useSessionBootstrap } from './useAuth'

vi.mock('../api/auth.api', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  refreshAccessToken: vi.fn(),
  register: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
})

describe('useSessionBootstrap', () => {
  it('is ready straight away, without a request, when there is no refresh token', () => {
    const { result } = renderHook(() => useSessionBootstrap())

    expect(result.current).toBe(true)
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('exchanges the stored refresh token for an access token, then becomes ready', async () => {
    useAuthStore.setState({ refreshToken: 'refresh-1' })
    refreshAccessToken.mockResolvedValue({ access_token: 'fresh-access' })

    const { result } = renderHook(() => useSessionBootstrap())

    expect(result.current).toBe(false)
    await waitFor(() => expect(result.current).toBe(true))
    expect(refreshAccessToken).toHaveBeenCalledWith('refresh-1')
    expect(useAuthStore.getState().accessToken).toBe('fresh-access')
  })

  it('clears the session and becomes ready when the refresh token is refused', async () => {
    useAuthStore.setState({ user: { id: 1 }, refreshToken: 'expired-refresh' })
    refreshAccessToken.mockRejectedValue(new Error('refused'))

    const { result } = renderHook(() => useSessionBootstrap())

    await waitFor(() => expect(result.current).toBe(true))
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
    })
  })

  // React runs every effect twice in development StrictMode. Two refresh calls
  // with the same token would break as soon as the backend rotates refresh tokens.
  it('sends only one refresh request under StrictMode', async () => {
    useAuthStore.setState({ refreshToken: 'refresh-1' })
    refreshAccessToken.mockResolvedValue({ access_token: 'fresh-access' })

    const { result } = renderHook(() => useSessionBootstrap(), { wrapper: StrictMode })

    await waitFor(() => expect(result.current).toBe(true))
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
  })
})
