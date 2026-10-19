import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api'

import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from './useNotifications'

vi.mock('../api/notifications.api', () => ({
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

const page = {
  items: [
    {
      id: 'n-1',
      type: 'email_verified',
      title: 'Email verified',
      body: null,
      link: null,
      read_at: null,
      created_at: '2026-10-15T10:00:00Z',
    },
  ],
  total: 1,
  limit: 20,
  offset: 0,
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

describe('notification hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the list with the given paging', async () => {
    listNotifications.mockResolvedValue(page)

    const { result } = renderHook(() => useNotifications({ limit: 20 }), { wrapper: setup() })

    await waitFor(() => expect(result.current.data).toEqual(page))
    expect(listNotifications).toHaveBeenCalledWith({ limit: 20 })
  })

  it('waits to load the list until enabled', () => {
    renderHook(() => useNotifications({}, { enabled: false }), { wrapper: setup() })

    expect(listNotifications).not.toHaveBeenCalled()
  })

  it('loads the unread count', async () => {
    getUnreadCount.mockResolvedValue(3)

    const { result } = renderHook(() => useUnreadCount(), { wrapper: setup() })

    await waitFor(() => expect(result.current.data).toBe(3))
  })

  it('refetches the count and the list after marking one read', async () => {
    getUnreadCount.mockResolvedValueOnce(2).mockResolvedValue(1)
    listNotifications.mockResolvedValue(page)
    markNotificationRead.mockResolvedValue({ ...page.items[0], read_at: '2026-10-15T10:05:00Z' })

    const { result } = renderHook(
      () => ({
        count: useUnreadCount(),
        list: useNotifications(),
        markRead: useMarkRead(),
      }),
      { wrapper: setup() },
    )
    await waitFor(() => expect(result.current.count.data).toBe(2))

    await act(() => result.current.markRead.mutateAsync('n-1'))

    expect(markNotificationRead).toHaveBeenCalledWith('n-1')
    await waitFor(() => expect(result.current.count.data).toBe(1))
    expect(listNotifications).toHaveBeenCalledTimes(2)
  })

  it('refetches the count after marking everything read', async () => {
    getUnreadCount.mockResolvedValueOnce(4).mockResolvedValue(0)
    markAllNotificationsRead.mockResolvedValue(undefined)

    const { result } = renderHook(() => ({ count: useUnreadCount(), markAll: useMarkAllRead() }), {
      wrapper: setup(),
    })
    await waitFor(() => expect(result.current.count.data).toBe(4))

    await act(() => result.current.markAll.mutateAsync())

    await waitFor(() => expect(result.current.count.data).toBe(0))
  })
})
