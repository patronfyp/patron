import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth'
// Imported directly to mock it; app code uses the barrels.
// eslint-disable-next-line no-restricted-imports
import { getMyCompany, getCompanyInvites } from '@/features/companies/api/companies.api'
// eslint-disable-next-line no-restricted-imports
import { getJobs } from '@/features/jobs/api/jobs.api'
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

vi.mock('@/features/companies/api/companies.api', () => ({
  getMyCompany: vi.fn(),
  getCompanyInvites: vi.fn(),
}))

vi.mock('@/features/jobs/api/jobs.api', () => ({
  getJobs: vi.fn(),
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

const GARNER = { id: 'c-1', name: 'Garner', domain: 'garner.com', my_role: 'owner' }

describe('AllSetPage for a recruiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: 'user-1', email: 'sam@garner.com', full_name: 'Sam Khan', roles: ['recruiter'] },
      accessToken: 'token',
    })
    getProfile.mockResolvedValue({ skills: [], cv: null, open_to_referrers: true })
    getVerificationStatus.mockResolvedValue(status({ employer_email: { email: 'sam@garner.com' } }))
  })

  it('summarises the company, team and roles for someone who built their own company', async () => {
    getMyCompany.mockResolvedValue(GARNER)
    getCompanyInvites.mockResolvedValue([{ id: 'i-1' }, { id: 'i-2' }])
    getJobs.mockResolvedValue([{ id: 'j-1' }])

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'You are ready to hire, Sam' }),
    ).toBeInTheDocument()
    expect(screen.getByText('garner.com')).toBeInTheDocument()
    expect(screen.getByText('2 people invited')).toBeInTheDocument()
    expect(screen.getByText('1 role drafted')).toBeInTheDocument()
    // Real data only - no invented candidate counts.
    expect(screen.queryByText(/referred candidates/)).not.toBeInTheDocument()
  })

  it('shows "not yet" rows for a company with no invites or roles yet', async () => {
    getMyCompany.mockResolvedValue(GARNER)
    getCompanyInvites.mockResolvedValue([])
    getJobs.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('No invites sent yet')).toBeInTheDocument()
    expect(screen.getByText('No roles drafted yet')).toBeInTheDocument()
  })

  it('sends both buttons home for a recruiter', async () => {
    const user = userEvent.setup()
    getMyCompany.mockResolvedValue(GARNER)
    getCompanyInvites.mockResolvedValue([])
    getJobs.mockResolvedValue([])
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Post first job' }))

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
  })

  it('gives an invited hiring manager a plain landing instead of the recruiter rows', async () => {
    getMyCompany.mockResolvedValue({ ...GARNER, my_role: 'hiring_manager' })
    getCompanyInvites.mockResolvedValue([])
    getJobs.mockResolvedValue([])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'You’re all set, Sam' })).toBeInTheDocument()
    expect(screen.queryByText('Company verified')).not.toBeInTheDocument()
    expect(screen.queryByText('Team invited')).not.toBeInTheDocument()
  })
})
