/**
 * Tests for the App screen.
 *
 * These are the project's first frontend tests, kept simple so they can be
 * copied as a starting point. Every test follows the same three steps:
 *
 *   Arrange - render the component in the state you want to test
 *   Act     - do what a user would do (or, here, let the request resolve)
 *   Assert  - check what the user can now see
 *
 * Note what we query by: visible text, not CSS classes or component internals.
 * A test written that way still passes after a refactor, and fails when the
 * user-visible behaviour actually breaks.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { api } from './lib/api'

// Replace the real axios client with a fake one. Tests must never hit the
// network: a test that needs the backend running is not a unit test, it is a
// second way for the suite to fail.
vi.mock('./lib/api', () => ({
  api: { get: vi.fn() },
}))

/**
 * Renders App with the providers it needs.
 *
 * A fresh QueryClient per test means no cached data leaks between tests.
 * `retry: false` stops React Query retrying a deliberately failed request,
 * which would otherwise make the error test slow.
 */
function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
