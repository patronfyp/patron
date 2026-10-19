import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPublicProfile } from '../api/profile.api'

import { usePublicProfile } from './usePublicProfile'

vi.mock('../api/profile.api', () => ({ getPublicProfile: vi.fn() }))

const profile = {
  user_id: 'u-2',
  full_name: 'Sarah Chen',
  roles: ['candidate'],
  skills: ['React'],
  university_verified: true,
  employer_verified: false,
}

// The real app retries once with a delay; the tests keep the app's own retry
// rule (the hook sets it) but run with no delay between attempts.
function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

const httpError = (status) => Object.assign(new Error('failed'), { response: { status } })

describe('usePublicProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the profile for the user id', async () => {
    getPublicProfile.mockResolvedValue(profile)

    const { result } = renderHook(() => usePublicProfile('u-2'), { wrapper: setup() })

    await waitFor(() => expect(result.current.data).toEqual(profile))
    expect(getPublicProfile).toHaveBeenCalledWith('u-2')
  })

  it('fetches nothing until there is a user id', () => {
    renderHook(() => usePublicProfile(undefined), { wrapper: setup() })

    expect(getPublicProfile).not.toHaveBeenCalled()
  })

  it('does not retry a 404 - the user is not there and will not appear', async () => {
    getPublicProfile.mockRejectedValue(httpError(404))

    const { result } = renderHook(() => usePublicProfile('missing'), { wrapper: setup() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getPublicProfile).toHaveBeenCalledTimes(1)
  })

  it('retries a failure that might pass, once', async () => {
    getPublicProfile.mockRejectedValue(httpError(503))

    const { result } = renderHook(() => usePublicProfile('u-2'), { wrapper: setup() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getPublicProfile).toHaveBeenCalledTimes(2)
  })
})
