import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api'

import NotificationPanel from './NotificationPanel'

vi.mock('../api/notifications.api', () => ({
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString()

const emailVerified = {
  id: 'n-1',
  type: 'email_verified',
  title: 'Email verified',
  body: 'Your work email is confirmed.',
  link: '/onboarding',
  read_at: null,
  created_at: minutesAgo(2),
}
const documentUploaded = {
  id: 'n-2',
  type: 'document_uploaded',
  title: 'Document received',
  body: null,
  link: null,
  read_at: minutesAgo(1),
  created_at: minutesAgo(30),
}

const pageOf = (...items) => ({ items, total: items.length, limit: 20, offset: 0 })

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderPanel(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/home']}>
          <NotificationPanel onClose={onClose} />
          <Where />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
  return onClose
}

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listNotifications.mockResolvedValue(pageOf(emailVerified, documentUploaded))
    getUnreadCount.mockResolvedValue(1)
    markNotificationRead.mockResolvedValue({ ...emailVerified, read_at: minutesAgo(0) })
    markAllNotificationsRead.mockResolvedValue(undefined)
  })

  it('lists each notification with its message and age, marking only unread ones', async () => {
    renderPanel()

    // Wait for the rows themselves: while loading, the skeleton is <li>s too.
    await screen.findByText('Email verified')
    const rows = screen.getAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Email verified')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Your work email is confirmed/)).toBeInTheDocument()
    expect(within(rows[0]).getByText('2 min ago')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Unread')).toBeInTheDocument()
    expect(within(rows[1]).queryByText('Unread')).not.toBeInTheDocument()
  })

  it('shows the loading state until the list arrives', async () => {
    let finish
    listNotifications.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderPanel()

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()

    finish(pageOf(emailVerified))
    expect(await screen.findByText('Email verified')).toBeInTheDocument()
  })

  it('says everything is read when there are no notifications', async () => {
    listNotifications.mockResolvedValue(pageOf())
    getUnreadCount.mockResolvedValue(0)
    renderPanel()

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument()
  })

  it('shows an error with a Retry that loads again', async () => {
    const user = userEvent.setup()
    listNotifications.mockRejectedValueOnce(new Error('network'))
    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your notifications')

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Email verified')).toBeInTheDocument()
  })

  it('filters by tab and counts unread per tab', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Email verified')

    const verification = screen.getByRole('button', { name: /Verification/ })
    expect(verification).toHaveTextContent('1')
    await user.click(verification)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /Referrals/ }))
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
  })

  it('marks an unread notification read and follows its link', async () => {
    const user = userEvent.setup()
    const onClose = renderPanel()

    await user.click(await screen.findByRole('button', { name: /Email verified/ }))

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('n-1'))
    expect(screen.getByTestId('where')).toHaveTextContent('/onboarding')
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call the API for one already read, and stays when it has no link', async () => {
    const user = userEvent.setup()
    const onClose = renderPanel()

    await user.click(await screen.findByRole('button', { name: /Document received/ }))

    expect(markNotificationRead).not.toHaveBeenCalled()
    expect(screen.getByTestId('where')).toHaveTextContent('/home')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('never follows a link that leaves the app', async () => {
    const user = userEvent.setup()
    listNotifications.mockResolvedValue(
      pageOf({ ...emailVerified, id: 'n-3', title: 'Offsite', link: 'https://example.com/x' }),
    )
    const onClose = renderPanel()

    await user.click(await screen.findByRole('button', { name: /Offsite/ }))

    expect(screen.getByTestId('where')).toHaveTextContent('/home')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('marks everything read, and disables that when nothing is unread', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Email verified')

    await user.click(screen.getByRole('button', { name: 'Mark all read' }))

    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled())
  })

  it('disables "Mark all read" when the unread count is zero', async () => {
    getUnreadCount.mockResolvedValue(0)
    renderPanel()
    await screen.findByText('Email verified')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled(),
    )
  })
})
