import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth'
// The test mocks the HTTP calls under the verification hooks, so it imports
// that module directly - app code goes through '@/features/verification'.
// eslint-disable-next-line no-restricted-imports
import {
  confirmVerificationCode,
  getVerificationStatus,
  sendVerificationCode,
} from '@/features/verification/api/verification.api'

import { completeOnboarding, getProfile, updateProfile } from '../api/onboarding.api'

import OnboardingPage from './OnboardingPage'

vi.mock('../api/onboarding.api', async (importOriginal) => ({
  ...(await importOriginal()),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  completeOnboarding: vi.fn(),
}))

vi.mock('@/features/verification/api/verification.api', () => ({
  getVerificationStatus: vi.fn(),
  sendVerificationCode: vi.fn(),
  confirmVerificationCode: vi.fn(),
  uploadVerificationDocument: vi.fn(),
}))

const EMAIL = 'jane@example.com'

function profileAt(step) {
  return {
    headline: null,
    city: null,
    phone: null,
    linkedin_url: null,
    bio: null,
    photo_url: null,
    university: null,
    degree: null,
    graduation_year: null,
    employer_name: null,
    cv: null,
    skills: [],
    primary_role: null,
    desired_roles: [],
    work_mode: null,
    preferred_locations: [],
    salary_min: null,
    salary_max: null,
    available_from: null,
    open_to_referrers: true,
    job_title: null,
    team: null,
    referral_teams: [],
    monthly_referral_limit: 5,
    accept_alumni_requests: true,
    accept_any_verified_requests: false,
    onboarding_step: step,
    onboarding_completed: false,
  }
}

function signIn({ roles = ['candidate'], verified = true } = {}) {
  useAuthStore.setState({
    user: { id: 'user-1', email: EMAIL, full_name: 'Jane Doe', roles, is_email_verified: verified },
    accessToken: 'token',
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/onboarding/done" element={<div>All set screen</div>} />
            <Route path="/" element={<div>Home screen</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signIn()
    updateProfile.mockImplementation(async (changes) => ({ ...profileAt(1), ...changes }))
    completeOnboarding.mockResolvedValue({ ...profileAt(7), onboarding_completed: true })
    getVerificationStatus.mockResolvedValue({
      email: EMAIL,
      email_verified: true,
      university_email: null,
      employer_email: null,
      documents: [],
    })
    sendVerificationCode.mockResolvedValue({ resend_after_seconds: 60 })
  })

  it('resumes at the step saved on the profile', async () => {
    getProfile.mockResolvedValue(profileAt(6))

    renderPage()

    expect(await screen.findByText(/Step 6 of 7/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Check your skills' })).toBeInTheDocument()
  })

  it('goes back a step without saving', async () => {
    const user = userEvent.setup()
    getProfile.mockResolvedValue(profileAt(2))
    renderPage()
    await screen.findByText(/Step 2 of 7/)

    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(await screen.findByText(/Step 1 of 7/)).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('has no Back button on the first step', async () => {
    getProfile.mockResolvedValue(profileAt(1))
    renderPage()
    await screen.findByText(/Step 1 of 7/)

    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('saves the current step and leaves on Save & exit', async () => {
    const user = userEvent.setup()
    getProfile.mockResolvedValue(profileAt(2))
    renderPage()
    await screen.findByText(/Step 2 of 7/)

    await user.click(screen.getByRole('button', { name: /save & exit/i }))

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ onboarding_step: 2 }))
  })

  it('stays on the step and shows the server message when saving fails', async () => {
    const user = userEvent.setup()
    getProfile.mockResolvedValue(profileAt(1))
    updateProfile.mockRejectedValue({ response: { data: { detail: 'Cannot move ahead' } } })
    renderPage()
    await screen.findByText(/Step 1 of 7/)

    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText('Cannot move ahead')).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument()
  })

  describe('Account step', () => {
    it('sends a code to the sign-up email as soon as it opens', async () => {
      signIn({ verified: false })
      getProfile.mockResolvedValue(profileAt(1))

      renderPage()

      expect(await screen.findByText(EMAIL)).toBeInTheDocument()
      // [0][0]: react-query also passes its own context as a second argument.
      await waitFor(() =>
        expect(sendVerificationCode.mock.calls[0][0]).toEqual({ email: EMAIL, kind: 'account' }),
      )
      expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument()
    })

    it('confirms the code on "Verify email", then moves on', async () => {
      const user = userEvent.setup()
      signIn({ verified: false })
      getProfile.mockResolvedValue(profileAt(1))
      confirmVerificationCode.mockResolvedValue({ verified_at: '2026-10-12T00:00:00Z' })
      renderPage()
      await screen.findByText(/Step 1 of 7/)

      const boxes = within(screen.getByRole('group', { name: '6-digit code' })).getAllByRole(
        'textbox',
      )
      await user.type(boxes[0], '123456')
      await user.click(screen.getByRole('button', { name: /verify email/i }))

      expect(await screen.findByText(/Step 2 of 7/)).toBeInTheDocument()
      expect(confirmVerificationCode.mock.calls[0][0]).toEqual({
        email: EMAIL,
        kind: 'account',
        code: '123456',
      })
      expect(useAuthStore.getState().user.is_email_verified).toBe(true)
    })

    it('asks for the whole code before verifying', async () => {
      const user = userEvent.setup()
      signIn({ verified: false })
      getProfile.mockResolvedValue(profileAt(1))
      renderPage()
      await screen.findByText(/Step 1 of 7/)

      await user.click(screen.getByRole('button', { name: /verify email/i }))

      expect(await screen.findByText('Enter the 6-digit code from the email.')).toBeInTheDocument()
      expect(confirmVerificationCode).not.toHaveBeenCalled()
      expect(updateProfile).not.toHaveBeenCalled()
    })

    it('lets an already verified user continue without a code', async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(1))
      renderPage()
      await screen.findByText(/Step 1 of 7/)

      await user.click(screen.getByRole('button', { name: /^continue/i }))

      expect(await screen.findByText(/Step 2 of 7/)).toBeInTheDocument()
      expect(sendVerificationCode).not.toHaveBeenCalled()
    })
  })

  describe('Profile step', () => {
    it('requires a headline', async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(2))
      renderPage()
      await screen.findByText(/Step 2 of 7/)

      await user.click(screen.getByRole('button', { name: /continue/i }))

      expect(await screen.findByText(/Add a headline/)).toBeInTheDocument()
      expect(updateProfile).not.toHaveBeenCalled()
    })

    it('saves the profile fields, with the phone in +92 form', { timeout: 15000 }, async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(2))
      renderPage()
      await screen.findByText(/Step 2 of 7/)

      await user.type(screen.getByLabelText('Headline'), 'Final-year CS student')
      await user.type(screen.getByLabelText('Phone'), '3001234567')
      await user.type(screen.getByLabelText('LinkedIn profile'), 'linkedin.com/in/jane-doe')
      await user.type(screen.getByLabelText('Short bio'), 'I build backends.')
      await user.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            headline: 'Final-year CS student',
            phone: '+923001234567',
            linkedin_url: 'linkedin.com/in/jane-doe',
            bio: 'I build backends.',
            onboarding_step: 3,
          }),
        ),
      )
    })
  })

  describe('University step', () => {
    it('blocks Continue until university, degree and year are filled in', async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(3))
      renderPage()
      await screen.findByText(/Step 3 of 7/)

      await user.click(screen.getByRole('button', { name: /continue/i }))

      expect(await screen.findByText('Select your university')).toBeInTheDocument()
      expect(screen.getByText('Enter your degree')).toBeInTheDocument()
      expect(screen.getByText('Select your graduation year')).toBeInTheDocument()
      expect(updateProfile).not.toHaveBeenCalled()
    })

    it('saves the university fields - and only those - when filled in', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      getProfile.mockResolvedValue(profileAt(3))
      renderPage()
      await screen.findByText(/Step 3 of 7/)

      // The list only draws its first options - search, as a user would.
      await user.type(screen.getByLabelText('University'), 'Habib')
      await user.click(await screen.findByTitle('Habib University'))
      await user.type(screen.getByLabelText('Degree'), 'BSc Computer Science')
      await user.click(screen.getByLabelText('Graduation year'))
      await user.click(await screen.findByTitle('2026'))
      await user.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith({
          university: 'Habib University',
          degree: 'BSc Computer Science',
          graduation_year: 2026,
          onboarding_step: 4,
        }),
      )
    })

    it('offers the university email for a university verifiable by email', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      getProfile.mockResolvedValue(profileAt(3))
      renderPage()
      await screen.findByText(/Step 3 of 7/)

      await user.click(screen.getByLabelText('University'))
      await user.click(await screen.findByTitle('Lahore University of Management Sciences (LUMS)'))

      expect(screen.getByRole('radio', { name: /university email/i })).toBeChecked()
      expect(screen.getByText('We send a code to your @lums.edu.pk address.')).toBeInTheDocument()
      expect(await screen.findByLabelText('University email')).toBeInTheDocument()

      await user.click(screen.getByRole('radio', { name: /registrar record/i }))

      expect(screen.queryByLabelText('University email')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /upload transcript or degree/i })).toBeVisible()
    })
  })

  describe('Employer step', () => {
    it('lets a candidate skip it without saving any employer', async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(4))
      renderPage()
      await screen.findByText(/Step 4 of 7/)

      await user.click(screen.getByRole('button', { name: /skip for now/i }))

      expect(await screen.findByText(/Step 5 of 7/)).toBeInTheDocument()
      expect(updateProfile).toHaveBeenCalledWith({ onboarding_step: 5 })
    })

    it('requires a company, with no skip, for someone who refers', async () => {
      const user = userEvent.setup()
      signIn({ roles: ['candidate', 'referrer'] })
      getProfile.mockResolvedValue(profileAt(4))
      renderPage()
      await screen.findByText(/Step 4 of 7/)

      expect(screen.queryByRole('button', { name: /skip for now/i })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /continue/i }))

      expect(await screen.findByText('Select the company you work at')).toBeInTheDocument()
      expect(updateProfile).not.toHaveBeenCalled()
    })

    it('shows the company card and code, and saves only the employer name', async () => {
      const user = userEvent.setup()
      signIn({ roles: ['candidate', 'referrer'] })
      getProfile.mockResolvedValue(profileAt(4))
      renderPage()
      await screen.findByText(/Step 4 of 7/)

      await user.click(screen.getByLabelText('Company'))
      await user.click(await screen.findByTitle('Garner'))

      expect(screen.getByText('Work email at Garner')).toBeInTheDocument()
      // Nothing is matched until a work email on garner.com is verified.
      expect(screen.queryByText('Domain matched')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith({ employer_name: 'Garner', onboarding_step: 5 }),
      )
    })
  })

  describe('Preferences step', () => {
    it('saves the roles and salary range, then finishes and opens All set', async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(7))
      renderPage()
      await screen.findByText(/Step 7 of 7/)

      await user.click(screen.getByRole('button', { name: 'Backend Engineer' }))
      await user.type(screen.getByLabelText('Expected salary (monthly)'), '250,000 - 350,000')
      await user.click(screen.getByRole('button', { name: /finish setup/i }))

      expect(await screen.findByText('All set screen')).toBeInTheDocument()
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          desired_roles: ['backend_engineer'],
          salary_min: 250000,
          salary_max: 350000,
          onboarding_step: 7,
        }),
      )
      expect(completeOnboarding).toHaveBeenCalled()
    })
  })

  describe('Referrer wizard', () => {
    beforeEach(() => signIn({ roles: ['referrer'] }))

    it('gives a referrer-only user three steps and the Referrer chip', async () => {
      getProfile.mockResolvedValue(profileAt(2))

      renderPage()

      expect(await screen.findByText(/Step 2 of 3 · Employer/)).toBeInTheDocument()
      expect(screen.getByText('Referrer')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Verify where you work' })).toBeInTheDocument()
    })

    it('requires the company and job title', async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(2))
      renderPage()
      await screen.findByText(/Step 2 of 3/)

      await user.click(screen.getByRole('button', { name: /continue/i }))

      expect(await screen.findByText('Select the company you work at')).toBeInTheDocument()
      expect(screen.getByText('Enter your job title')).toBeInTheDocument()
      expect(updateProfile).not.toHaveBeenCalled()
    })

    it('saves the employer, title and team once a work email there is verified', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      getVerificationStatus.mockResolvedValue({
        email: EMAIL,
        email_verified: true,
        university_email: null,
        employer_email: { email: 'jane@garner.com' },
        documents: [],
      })
      getProfile.mockResolvedValue(profileAt(2))
      renderPage()
      await screen.findByText(/Step 2 of 3/)

      await user.click(screen.getByLabelText('Where do you work?'))
      await user.click(await screen.findByTitle('Garner'))
      await user.type(screen.getByLabelText('Job title'), 'Senior Software Engineer')
      await user.type(screen.getByLabelText('Team'), 'Payments')
      await user.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith({
          employer_name: 'Garner',
          job_title: 'Senior Software Engineer',
          team: 'Payments',
          onboarding_step: 3,
        }),
      )
    })

    it('blocks Continue without proof of employment at the chosen company', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      // Verified - but at a different company, so it proves nothing for Garner.
      getVerificationStatus.mockResolvedValue({
        email: EMAIL,
        email_verified: true,
        university_email: null,
        employer_email: { email: 'jane@careem.com' },
        documents: [],
      })
      getProfile.mockResolvedValue(profileAt(2))
      renderPage()
      await screen.findByText(/Step 2 of 3/)

      await user.click(screen.getByLabelText('Where do you work?'))
      await user.click(await screen.findByTitle('Garner'))
      await user.type(screen.getByLabelText('Job title'), 'Engineer')
      await user.click(screen.getByRole('button', { name: /continue/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Verify your work email or upload an employment letter to continue.',
      )
      expect(updateProfile).not.toHaveBeenCalled()
    })

    it('accepts an employment letter waiting for review as proof', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      getVerificationStatus.mockResolvedValue({
        email: EMAIL,
        email_verified: true,
        university_email: null,
        employer_email: null,
        documents: [{ kind: 'employer', status: 'pending' }],
      })
      getProfile.mockResolvedValue(profileAt(2))
      renderPage()
      await screen.findByText(/Step 2 of 3/)

      expect(screen.getByRole('radio', { name: /employment letter/i })).toBeChecked()
      await user.click(screen.getByLabelText('Where do you work?'))
      await user.click(await screen.findByTitle('Garner'))
      await user.type(screen.getByLabelText('Job title'), 'Engineer')
      await user.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({ employer_name: 'Garner', onboarding_step: 3 }),
        ),
      )
    })

    it('offers an employment letter instead of a work email', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      getProfile.mockResolvedValue(profileAt(2))
      renderPage()
      await screen.findByText(/Step 2 of 3/)

      expect(screen.getByLabelText('Work email')).toBeInTheDocument()

      await user.click(screen.getByRole('radio', { name: /employment letter/i }))

      expect(screen.queryByLabelText('Work email')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /upload employment letter/i })).toBeVisible()
    })

    it('saves the referring settings and finishes', async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(3))
      renderPage()
      await screen.findByText(/Step 3 of 3 · Referring/)

      await user.click(screen.getByRole('button', { name: 'Backend' }))
      await user.click(screen.getByText('No limit'))
      await user.click(screen.getByRole('switch'))
      await user.click(screen.getByRole('button', { name: /finish setup/i }))

      expect(await screen.findByText('All set screen')).toBeInTheDocument()
      expect(updateProfile).toHaveBeenCalledWith({
        referral_teams: ['backend'],
        monthly_referral_limit: null,
        accept_any_verified_requests: true,
        onboarding_step: 3,
      })
      expect(completeOnboarding).toHaveBeenCalled()
    })

    it('shows the alumni toggle only once the university email is verified', async () => {
      getVerificationStatus.mockResolvedValue({
        email: EMAIL,
        email_verified: true,
        university_email: { email: 'jane@lums.edu.pk' },
        employer_email: null,
        documents: [],
      })
      getProfile.mockResolvedValue({
        ...profileAt(3),
        university: 'Lahore University of Management Sciences (LUMS)',
      })

      renderPage()

      expect(await screen.findByText('Accept requests from LUMS alumni')).toBeInTheDocument()
      expect(screen.getAllByRole('switch')).toHaveLength(2)
    })

    it('hides the alumni toggle without a verified university', async () => {
      getProfile.mockResolvedValue(profileAt(3))

      renderPage()

      await screen.findByText(/Step 3 of 3/)
      expect(screen.queryByText(/alumni$/)).not.toBeInTheDocument()
      expect(screen.getAllByRole('switch')).toHaveLength(1)
    })
  })

  it('offers a retry when the profile cannot be loaded', async () => {
    const user = userEvent.setup()
    getProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(profileAt(3))
    renderPage()

    await user.click(await screen.findByRole('button', { name: /try again/i }))

    await waitFor(() => expect(screen.getByText(/Step 3 of 7/)).toBeInTheDocument())
  })
})
