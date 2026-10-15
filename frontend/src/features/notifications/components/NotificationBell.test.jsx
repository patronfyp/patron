import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getUnreadCount } from '../api/notifications.api'

import NotificationBell from './NotificationBell'

vi.mock('../api/notifications.api', () => ({
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>,
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the unread count on the bell', async () => {
    getUnreadCount.mockResolvedValue(5)
    renderBell()

    const bell = await screen.findByRole('button', { name: 'Notifications, 5 unread' })

    expect(bell).toHaveTextContent('5')
  })

  it('caps a large count at 99+', async () => {
    getUnreadCount.mockResolvedValue(240)
    renderBell()

    expect(await screen.findByText('99+')).toBeInTheDocument()
  })

  it('shows no badge when everything is read', async () => {
    getUnreadCount.mockResolvedValue(0)
    renderBell()

    const bell = await screen.findByRole('button', { name: 'Notifications' })
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalled())

    expect(bell).not.toHaveTextContent(/\d/)
  })

  it('opens the panel on click, refetches the count, and closes on Escape', async () => {
    const user = userEvent.setup()
    getUnreadCount.mockResolvedValue(2)
    renderBell()
    const bell = await screen.findByRole('button', { name: 'Notifications, 2 unread' })
    expect(getUnreadCount).toHaveBeenCalledTimes(1)

    await user.click(bell)

    expect(await screen.findByRole('dialog', { name: 'Notifications' })).toBeInTheDocument()
    expect(bell).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalledTimes(2))

    await user.keyboard('{Escape}')

    await waitFor(() => expect(bell).toHaveAttribute('aria-expanded', 'false'))
    expect(bell).toHaveFocus()
  })
})
