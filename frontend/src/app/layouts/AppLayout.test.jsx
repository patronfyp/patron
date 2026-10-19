import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { App as AntApp } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth'
import { fakeNetwork, ok, restoreNetwork } from '@/test/fakeNetwork'

import AppLayout from './AppLayout'

const user = { id: 'u-1', email: 'abdul@example.com', full_name: 'Abdul Rafay' }

function renderLayout(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter>
          <AppLayout {...props}>
            <p>Page content</p>
          </AppLayout>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

// Only the clock's Date is faked: the greeting depends on it, while React
// Query and the DOM need real timers.
function setTime(hour) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, hour, 0))
}

describe('AppLayout', () => {
  beforeEach(() => {
    // The bell asks the API for its count; answer at the network, not by
    // reaching into the notifications feature's internals.
    fakeNetwork((config) => ok(config, { count: 3 }))
    useAuthStore.setState({ user })
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreNetwork()
    useAuthStore.setState({ user: null })
  })

  it('shows the page inside the layout', () => {
    renderLayout()

    expect(within(screen.getByRole('main')).getByText('Page content')).toBeInTheDocument()
  })

  it('greets the user by first name for the time of day', () => {
    setTime(9)
    renderLayout()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning, Abdul')
  })

  it('changes the greeting in the afternoon and evening', () => {
    setTime(14)
    const first = renderLayout()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good afternoon, Abdul')
    first.unmount()

    setTime(20)
    renderLayout()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good evening, Abdul')
  })

  it('uses a title in place of the greeting', () => {
    renderLayout({ title: 'My referrals', breadcrumb: ['Home', 'Referrals'] })

    expect(screen.getByRole('heading', { level: 1, name: 'My referrals' })).toBeInTheDocument()
  })

  it('shows the breadcrumb with the current page marked', () => {
    renderLayout()

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByText('Home')).toBeInTheDocument()
    expect(within(trail).getByText('Overview')).toHaveAttribute('aria-current', 'page')
  })

  it('shows the user initials on the avatar', () => {
    renderLayout()

    expect(screen.getByRole('img', { name: 'Abdul Rafay' })).toHaveTextContent('AR')
  })

  it('has the bell with the unread count', async () => {
    renderLayout()

    expect(
      await screen.findByRole('button', { name: 'Notifications, 3 unread' }),
    ).toBeInTheDocument()
  })

  it('shows the search box, which does nothing yet', () => {
    renderLayout()

    const search = screen.getByRole('button', { name: /Search jobs, people, companies/ })

    expect(search).toHaveAttribute('aria-disabled', 'true')
    expect(search).toHaveAttribute('title', 'Search is coming soon')
  })

  it('still renders a greeting when there is no name', () => {
    setTime(9)
    useAuthStore.setState({ user: { ...user, full_name: '' } })
    renderLayout()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning')
  })
})
