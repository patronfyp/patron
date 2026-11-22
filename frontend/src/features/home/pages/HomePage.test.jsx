import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { App as AntApp } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/features/auth'
import { appResponder, PROFILE } from '@/test/appData'
import { fakeNetwork, restoreNetwork } from '@/test/fakeNetwork'

import HomePage from './HomePage'

const candidate = { id: 'u-1', full_name: 'Abdul Rafay', roles: ['candidate'] }

function renderHome(data) {
  fakeNetwork(appResponder(data))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

function stat(label) {
  return screen.getByRole('region', { name: label })
}

describe('HomePage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: candidate })
  })

  afterEach(() => {
    restoreNetwork()
    useAuthStore.setState({ user: null })
  })

  it('shows profile readiness from the real profile and verification', async () => {
    renderHome()

    const card = await screen.findByRole('region', { name: /from a complete profile/ })
    // Email, headline and university are done: 3 of 9.
    expect(within(card).getByRole('img', { name: 'Profile 33% complete' })).toBeInTheDocument()
    expect(within(card).getByText('Next: Add a profile photo.')).toBeInTheDocument()
    expect(within(card).getByText('University verified')).toBeInTheDocument()
    expect(within(card).getByText('Employer · pending')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /Finish profile/ })).toHaveAttribute(
      'href',
      '/profile/edit',
    )
    expect(within(card).getByRole('link', { name: 'View profile' })).toHaveAttribute(
      'href',
      '/profile/u-1',
    )
  })

  it('says the profile is ready, without a Finish button, when nothing is missing', async () => {
    renderHome({
      profile: {
        ...PROFILE,
        photo_url: '/p.jpg',
        bio: 'Hi',
        linkedin_url: 'https://linkedin.com/in/a',
        cv: { filename: 'cv.pdf' },
        skills: ['React'],
        desired_roles: ['backend'],
      },
    })

    const card = await screen.findByRole('region', { name: 'Your profile is ready for referrals.' })
    expect(within(card).queryByRole('link', { name: /Finish profile/ })).not.toBeInTheDocument()
  })

  it('shows no readiness card to a user who is not a candidate', async () => {
    useAuthStore.setState({ user: { ...candidate, roles: ['referrer'] } })
    renderHome()

    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.queryByText('Referral readiness')).not.toBeInTheDocument()
  })

  it('counts connections, waiting requests and unread notifications', async () => {
    renderHome({
      requests: [
        { id: 'r-1', direction: 'received', person: { full_name: 'Bilal' } },
        { id: 'r-2', direction: 'received', person: { full_name: 'Sara' } },
      ],
    })

    expect(await within(stat('Connections')).findByText('12')).toBeInTheDocument()
    expect(await within(stat('Requests waiting')).findByText('2')).toBeInTheDocument()
    expect(await within(stat('Unread notifications')).findByText('3')).toBeInTheDocument()
  })

  it('lists recent notifications, linking the ones with a link', async () => {
    renderHome({
      notifications: {
        items: [
          {
            id: 'n-1',
            type: 'connection_request',
            title: 'Bilal wants to connect',
            body: null,
            link: '/connections',
            read_at: null,
            created_at: new Date().toISOString(),
          },
          {
            id: 'n-2',
            type: 'email_verified',
            title: 'abdul@lums.edu.pk is now verified',
            body: null,
            link: null,
            read_at: null,
            created_at: new Date().toISOString(),
          },
        ],
        total: 2,
        limit: 5,
        offset: 0,
      },
    })

    const activity = await screen.findByRole('region', { name: 'Recent activity' })
    expect(
      await within(activity).findByRole('link', { name: /Bilal wants to connect/ }),
    ).toHaveAttribute('href', '/connections')
    expect(within(activity).getByText('abdul@lums.edu.pk is now verified')).toBeInTheDocument()
  })

  it('says when there is no activity yet', async () => {
    renderHome()

    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument()
  })
})
