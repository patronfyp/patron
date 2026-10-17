import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth'
// The test mocks the HTTP call under the verification hook, so it imports
// that module directly - app code goes through '@/features/verification'.
// eslint-disable-next-line no-restricted-imports
import { getVerificationStatus } from '@/features/verification/api/verification.api'

import { getProfile } from '../api/onboarding.api'

import AllSetPage from './AllSetPage'

vi.mock('../api/onboarding.api', async (importOriginal) => ({
  ...(await importOriginal()),
  getProfile: vi.fn(),
}))

vi.mock('@/features/verification/api/verification.api', () => ({
  getVerificationStatus: vi.fn(),
}))

const EMAIL = 'sarah@gmail.com'

const REFERRER_PROFILE = {
  employer_name: 'Garner',
  job_title: 'Senior Software Engineer',
  team: 'Payments',
  monthly_referral_limit: 5,
  skills: [],
  cv: null,
  open_to_referrers: true,
}

function status(overrides = {}) {
  return {
    email: EMAIL,
    email_verified: true,
    university_email: null,
    employer_email: null,
    documents: [],
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/onboarding/done']}>
          <Routes>
            <Route path="/onboarding/done" element={<AllSetPage />} />
            <Route path="/onboarding" element={<div>Onboarding screen</div>} />
            <Route path="/" element={<div>Home screen</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('AllSetPage for a referrer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: 'user-1', email: EMAIL, full_name: 'Sarah Chen', roles: ['referrer'] },
      accessToken: 'token',
    })
    getProfile.mockResolvedValue(REFERRER_PROFILE)
  })

  it('summarises a verified employer and the monthly limit', async () => {
    getVerificationStatus.mockResolvedValue(
      status({ employer_email: { email: 'sarah@garner.com' } }),
    )

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'You are ready to refer, Sarah' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Employee at Garner')).toBeInTheDocument()
    expect(screen.getByText('Senior Software Engineer · Payments')).toBeInTheDocument()
    expect(screen.getByText('Employee Referral')).toBeInTheDocument()
    expect(screen.getByText('Up to 5 requests a month')).toBeInTheDocument()
    // Real data only - no invented candidate counts.
    expect(screen.queryByText(/candidates already match/)).not.toBeInTheDocument()
  })

  it('shows an employment letter as in review', async () => {
    getVerificationStatus.mockResolvedValue(
      status({ documents: [{ kind: 'employer', status: 'pending' }] }),
    )

    renderPage()

    expect(await screen.findByText('In review')).toBeInTheDocument()
    expect(screen.queryByText('Employee Referral')).not.toBeInTheDocument()
  })

  it('says "No monthly limit" when there is none', async () => {
    getVerificationStatus.mockResolvedValue(status())
    getProfile.mockResolvedValue({ ...REFERRER_PROFILE, monthly_referral_limit: null })

    renderPage()

    expect(await screen.findByText('No monthly limit')).toBeInTheDocument()
  })

  it('opens the wizard again from Edit settings', async () => {
    const user = userEvent.setup()
    getVerificationStatus.mockResolvedValue(status())
    renderPage()

    await user.click(await screen.findByRole('button', { name: /edit settings/i }))

    expect(await screen.findByText('Onboarding screen')).toBeInTheDocument()
  })
})
