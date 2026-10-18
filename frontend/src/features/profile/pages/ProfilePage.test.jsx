import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
})
