import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfile, updateProfile } from '../api/onboarding.api'

import OnboardingPage from './OnboardingPage'

vi.mock('../api/onboarding.api', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

function profileAt(step) {
  return {
    university: null,
    degree: null,
    graduation_year: null,
    employer_name: null,
    onboarding_step: step,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
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
    updateProfile.mockImplementation(async (changes) => ({ ...profileAt(1), ...changes }))
  })

  it('resumes at the step saved on the profile', async () => {
    getProfile.mockResolvedValue(profileAt(5))

    renderPage()

    expect(await screen.findByText(/Step 5 of 7/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your skills' })).toBeInTheDocument()
  })

  it('saves the next step and moves forward on Continue', async () => {
    const user = userEvent.setup()
    getProfile.mockResolvedValue(profileAt(1))
    renderPage()
    await screen.findByText(/Step 1 of 7/)

    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/Step 2 of 7/)).toBeInTheDocument()
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ onboarding_step: 2 }))
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

  it('finishes from the last step and goes home', async () => {
    const user = userEvent.setup()
    getProfile.mockResolvedValue(profileAt(7))
    renderPage()
    await screen.findByText(/Step 7 of 7/)

    await user.click(screen.getByRole('button', { name: /finish/i }))

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ onboarding_step: 7 }))
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
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(3))
      renderPage()
      await screen.findByText(/Step 3 of 7/)

      await user.click(screen.getByLabelText('University'))
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

    it('lets the verification method be chosen, defaulting to university email', async () => {
      const user = userEvent.setup()
      getProfile.mockResolvedValue(profileAt(3))
      renderPage()
      await screen.findByText(/Step 3 of 7/)

      expect(screen.getByRole('radio', { name: /university email/i })).toBeChecked()

      await user.click(screen.getByRole('radio', { name: /registrar record/i }))

      expect(screen.getByRole('radio', { name: /registrar record/i })).toBeChecked()
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
