import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth'
import { appResponder } from '@/test/appData'
import { fakeNetwork, restoreNetwork } from '@/test/fakeNetwork'

import AppLayout from './AppLayout'

const user = {
  id: 'u-1',
  email: 'abdul@example.com',
  full_name: 'Abdul Rafay',
  roles: ['candidate'],
}

/** The shell with two pages: Overview (greeting) and a profile (own heading). */
function renderAt(path) {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <p>Home content</p>,
            handle: { breadcrumb: ['Home', 'Overview'] },
          },
          {
            path: 'profile/:userId',
            element: <h1>Abdul Rafay</h1>,
            handle: { breadcrumb: ['Home', 'Profile'], title: null },
          },
          { path: 'settings', element: <p>Settings page</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </QueryClientProvider>,
  )
  return router
}

// Only the clock's Date is faked: the greeting depends on it, while React
// Query and the DOM need real timers.
function setTime(hour) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, hour, 0))
}

describe('AppLayout', () => {
  beforeEach(() => {
    fakeNetwork(appResponder())
    useAuthStore.setState({ user })
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreNetwork()
    useAuthStore.setState({ user: null })
  })

  it('renders the page inside the shell', () => {
    renderAt('/')

    expect(within(screen.getByRole('main')).getByText('Home content')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Main' })).toBeInTheDocument()
  })

  it('greets the user by first name for the time of day', () => {
    setTime(9)
    renderAt('/')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning, Abdul')
  })

  it('takes the breadcrumb from the route and marks the current page', () => {
    renderAt('/')

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByText('Overview')).toHaveAttribute('aria-current', 'page')
  })

  it('leaves the heading to a page that has its own', () => {
    renderAt('/profile/u-1')

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByText('Profile')).toHaveAttribute('aria-current', 'page')
    // Only the page's own h1, no greeting.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Abdul Rafay')
  })

  it('has the bell with the unread count', async () => {
    renderAt('/')

    expect(
      await screen.findByRole('button', { name: 'Notifications, 3 unread' }),
    ).toBeInTheDocument()
  })

  it('shows the user initials on the top bar avatar', () => {
    renderAt('/')

    expect(screen.getByRole('img', { name: 'Abdul Rafay' })).toHaveTextContent('AR')
  })
})

describe('Sidebar', () => {
  beforeEach(() => {
    fakeNetwork(appResponder())
    useAuthStore.setState({ user })
  })

  afterEach(() => {
    restoreNetwork()
    useAuthStore.setState({ user: null })
  })

  it('links only to pages that exist, with the current one marked', () => {
    renderAt('/')

    const nav = screen.getByRole('navigation', { name: 'Workspace' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Overview', 'Connections', 'Profile'])
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/profile/u-1',
    )
  })

  it('marks Profile current on the profile page', () => {
    renderAt('/profile/u-1')

    const nav = screen.getByRole('navigation', { name: 'Workspace' })
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
  })

  it('shows the name and the headline from the profile', async () => {
    renderAt('/')

    const account = screen.getByRole('button', { name: 'Account menu' })
    expect(within(account).getByText('Abdul Rafay')).toBeInTheDocument()
    expect(await within(account).findByText('Full-Stack AI Engineer')).toBeInTheDocument()
  })

  it('opens the account menu and goes to settings', async () => {
    const userEvents = userEvent.setup()
    const router = renderAt('/')

    await userEvents.click(screen.getByRole('button', { name: 'Account menu' }))
    await userEvents.click(await screen.findByText('Settings'))

    expect(router.state.location.pathname).toBe('/settings')
    expect(await screen.findByText('Settings page')).toBeInTheDocument()
  })

  // Each way in opens the same overlay. (Closing it is covered in PeopleSearch's
  // own tests: antd's fade-out doesn't finish under jsdom.)
  it.each([
    [
      'the sidebar search box',
      async (user) => user.click(screen.getByRole('button', { name: /Search PATRON/ })),
    ],
    [
      'the top bar search box',
      async (user) =>
        user.click(screen.getByRole('button', { name: /Search jobs, people, companies/ })),
    ],
    ['Ctrl+K', async (user) => user.keyboard('{Control>}k{/Control}')],
  ])('opens the people search from %s', async (_way, open) => {
    renderAt('/')

    await open(userEvent.setup())

    expect(await screen.findByRole('dialog', { name: 'Search people' })).toBeInTheDocument()
  })
  it('shows how many requests are waiting beside Connections', async () => {
    fakeNetwork(
      appResponder({
        requests: [
          { id: 'r-1', direction: 'received', person: { user_id: 'u-9', full_name: 'Sara' } },
        ],
      }),
    )
    renderAt('/')

    expect(await screen.findByLabelText('1 waiting')).toBeInTheDocument()
  })
})
