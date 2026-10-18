import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth'

import { getPublicProfile } from '../api/profile.api'

import ProfilePage from './ProfilePage'

vi.mock('../api/profile.api', () => ({ getPublicProfile: vi.fn() }))

const PROFILE = {
  user_id: 'u-2',
  full_name: 'Sarah Chen',
  roles: ['candidate'],
  photo_url: null,
  avatar_url: null,
  headline: 'Full-Stack Engineer',
  city: 'Lahore',
  bio: 'I build products.',
  linkedin_url: 'https://www.linkedin.com/in/sarah',
  university: 'Lahore University of Management Sciences (LUMS)',
  degree: 'BSc Computer Science',
  graduation_year: 2026,
  employer_name: 'Garner',
  skills: ['React', 'FastAPI'],
  primary_role: 'candidate',
  university_verified: true,
  employer_verified: false,
}

function renderPage(path = '/profile/u-2') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/profile/:userId" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

const verification = () =>
  screen.getByRole('heading', { name: 'Verification center' }).closest('section')

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null })
    getPublicProfile.mockResolvedValue(PROFILE)
  })

  it('loads the profile of the user id in the URL', async () => {
    renderPage('/profile/u-2')

    await screen.findByRole('heading', { name: 'Sarah Chen', level: 1 })
    expect(getPublicProfile).toHaveBeenCalledWith('u-2')
  })

  it('shows the identity: headline with city, and the verified university chip', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Sarah Chen' })
    expect(screen.getByText('Full-Stack Engineer · Lahore')).toBeInTheDocument()
    expect(screen.getByText('LUMS ’26 · Verified')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Verified' })).toBeInTheDocument()
  })

  it('shows the bio, the degree and the employer', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Sarah Chen' })
    expect(screen.getByText('I build products.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'BSc Computer Science' })).toBeInTheDocument()
    expect(screen.getByText('LUMS · 2026')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Garner' })).toBeInTheDocument()
  })

  it('marks an unverified employer as not verified, not as verified', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Sarah Chen' })
    expect(screen.getByText('Garner · not verified')).toBeInTheDocument()
    const rows = within(verification())
    expect(rows.getByText('Employer · Garner')).toBeInTheDocument()
    expect(rows.getAllByText('Not verified')).toHaveLength(1)
    expect(rows.getAllByText('Verified')).toHaveLength(1)
  })

  it('offers "Edit profile" on your own profile', async () => {
    useAuthStore.setState({ user: { id: 'u-2' } })
    renderPage('/profile/u-2')

    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
  })

  it('does not offer "Edit profile" on someone else\'s profile', async () => {
    useAuthStore.setState({ user: { id: 'someone-else' } })
    renderPage('/profile/u-2')

    await screen.findByRole('heading', { name: 'Sarah Chen' })
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument()
  })

  it('lists the skills', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Sarah Chen' })
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('FastAPI')).toBeInTheDocument()
  })

  it('links LinkedIn only when the address is a web link', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/sarah',
    )
  })

  it('does not render a link for an address that is not http(s)', async () => {
    getPublicProfile.mockResolvedValue({ ...PROFILE, linkedin_url: 'javascript:alert(1)' })
    renderPage()

    await screen.findByRole('heading', { name: 'Sarah Chen' })
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).not.toBeInTheDocument()
  })

  it('says so when there is nothing to show instead of leaving a card blank', async () => {
    getPublicProfile.mockResolvedValue({
      ...PROFILE,
      bio: null,
      headline: null,
      city: null,
      linkedin_url: null,
      university: null,
      degree: null,
      graduation_year: null,
      employer_name: null,
      skills: [],
      university_verified: false,
    })
    renderPage()

    await screen.findByRole('heading', { name: 'Sarah Chen' })
    expect(screen.getByText('No bio added yet.')).toBeInTheDocument()
    expect(screen.getByText('No employer or education added yet.')).toBeInTheDocument()
    expect(screen.getByText('Nothing to verify yet.')).toBeInTheDocument()
    expect(screen.getByText('No skills added yet.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Verified' })).not.toBeInTheDocument()
  })

  it('shows a loading state while the profile loads', () => {
    getPublicProfile.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByRole('status', { name: 'Loading profile' })).toBeInTheDocument()
  })

  it.each([404, 422])('says the profile is not found on a %i', async (status) => {
    getPublicProfile.mockRejectedValue(Object.assign(new Error('failed'), { response: { status } }))
    renderPage()

    expect(await screen.findByText('Profile not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('offers a retry on a failure that might pass, and shows the profile once it does', async () => {
    getPublicProfile.mockRejectedValueOnce(
      Object.assign(new Error('failed'), { response: { status: 503 } }),
    )
    getPublicProfile.mockRejectedValueOnce(
      Object.assign(new Error('failed'), { response: { status: 503 } }),
    )
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: 'Sarah Chen' })).toBeInTheDocument()
  })
})
