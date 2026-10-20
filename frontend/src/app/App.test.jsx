/**
 * Tests for the App screen - a simple Arrange, Act, Assert example to copy.
 * Query by visible text, never CSS classes, so a refactor doesn't break them.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth'
import { api } from '@/shared/api/client'

import App from './App'

// Tests never hit the network.
vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn() },
}))

/** Renders App with a fresh QueryClient (no shared cache, no retries). */
function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
  })

  it('shows the backend details once the health check succeeds', async () => {
    // Arrange - the backend will answer with a healthy response
    api.get.mockResolvedValue({
      data: { status: 'ok', env: 'test', database: 'ok' },
    })

    // Act
    renderApp()

    // Assert - findBy* waits for the request to resolve; getBy* does not
    expect(await screen.findByText('Backend connected')).toBeVisible()
    expect(screen.getByText('test')).toBeVisible()
    expect(api.get).toHaveBeenCalledWith('/health')
  })

  it('shows an error when the backend cannot be reached', async () => {
    // Arrange - the request will fail
    api.get.mockRejectedValue(new Error('Network Error'))

    // Act
    renderApp()

    // Assert - the failure is surfaced to the user, not swallowed
    expect(await screen.findByText('Backend not reachable')).toBeVisible()
    expect(screen.getByText('Network Error')).toBeVisible()
  })

  it('shows a loading state before the request resolves', () => {
    // Arrange - a promise that never settles, so we stay in the pending state
    api.get.mockReturnValue(new Promise(() => {}))

    // Act
    renderApp()

    // Assert
    expect(screen.getByText(/checking backend/i)).toBeVisible()
  })

  it('logs out and clears the session', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: { id: 1 }, accessToken: 'access-1', refreshToken: 'refresh-1' })
    api.get.mockResolvedValue({ data: { status: 'ok', env: 'test', database: 'ok' } })
    renderApp()
    await screen.findByText('Backend connected')

    await user.click(screen.getByRole('button', { name: /log out/i }))

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
    })
  })
})
