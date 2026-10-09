import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfile, updateProfile } from '../api/onboarding.api'

import { useProfile, useUpdateProfile } from './useProfile'

vi.mock('../api/onboarding.api', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

const emptyProfile = {
  university: null,
  degree: null,
  graduation_year: null,
  employer_name: null,
  onboarding_step: 1,
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the profile', async () => {
    getProfile.mockResolvedValue(emptyProfile)

    const { result } = renderHook(() => useProfile(), { wrapper: setup() })

    await waitFor(() => expect(result.current.data).toEqual(emptyProfile))
  })

  it('puts the saved profile straight into the cache after an update', async () => {
    getProfile.mockResolvedValue(emptyProfile)
    const saved = { ...emptyProfile, university: 'LUMS', onboarding_step: 2 }
    updateProfile.mockResolvedValue(saved)
    const wrapper = setup()

    const { result } = renderHook(() => ({ profile: useProfile(), update: useUpdateProfile() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.profile.data).toEqual(emptyProfile))

    await act(() => result.current.update.mutateAsync({ university: 'LUMS', onboarding_step: 2 }))

    await waitFor(() => expect(result.current.profile.data).toEqual(saved))
    expect(updateProfile).toHaveBeenCalledWith({ university: 'LUMS', onboarding_step: 2 })
    expect(getProfile).toHaveBeenCalledTimes(1)
  })
})
