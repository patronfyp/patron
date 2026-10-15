import { StrictMode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { changePassword, refreshAccessToken } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

import { useChangePassword, useSessionBootstrap } from './useAuth'

vi.mock('../api/auth.api', () => ({
  changePassword: vi.fn(),
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

describe('useChangePassword', () => {
  function withQueryClient() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return Wrapper
  }

  it('swaps in the fresh token pair, keeping the same user', async () => {
    useAuthStore.setState({
      user: { id: 1, email: 'jane@example.com' },
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    })
    changePassword.mockResolvedValue({ access_token: 'new-access', refresh_token: 'new-refresh' })

    const { result } = renderHook(() => useChangePassword(), { wrapper: withQueryClient() })
    await act(() =>
      result.current.mutateAsync({ currentPassword: 'old-pw', newPassword: 'new-pw-123' }),
    )

    expect(changePassword.mock.calls[0][0]).toEqual({
      currentPassword: 'old-pw',
      newPassword: 'new-pw-123',
    })
    expect(useAuthStore.getState()).toMatchObject({
      user: { id: 1, email: 'jane@example.com' },
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })
  })
})
