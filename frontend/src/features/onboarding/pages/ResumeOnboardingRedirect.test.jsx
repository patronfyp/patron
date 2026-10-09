import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfile } from '../api/onboarding.api'

import ResumeOnboardingRedirect from './ResumeOnboardingRedirect'

vi.mock('../api/onboarding.api', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

function renderAtStart() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route path="/start" element={<ResumeOnboardingRedirect />} />
          <Route path="/onboarding" element={<div>Onboarding screen</div>} />
          <Route path="/" element={<div>Home screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ResumeOnboardingRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a user with unfinished onboarding back into the wizard', async () => {
    getProfile.mockResolvedValue({ onboarding_step: 3 })

    renderAtStart()

    expect(await screen.findByText('Onboarding screen')).toBeInTheDocument()
  })

  it('sends a user who reached the last step home', async () => {
    getProfile.mockResolvedValue({ onboarding_step: 7 })

    renderAtStart()

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
  })

  it('goes home rather than blocking sign-in when the profile cannot be loaded', async () => {
    getProfile.mockRejectedValue(new Error('offline'))

    renderAtStart()

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
  })
})
