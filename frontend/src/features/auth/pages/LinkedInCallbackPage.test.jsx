import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUser } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

import LinkedInCallbackPage from './LinkedInCallbackPage'

vi.mock('../api/auth.api', () => ({
  getCurrentUser: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/auth/linkedin/callback']}>
          <Routes>
            <Route path="/auth/linkedin/callback" element={<LinkedInCallbackPage />} />
            <Route path="/" element={<div>Home screen</div>} />
            <Route path="/login" element={<div>Login screen</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('LinkedInCallbackPage', () => {
  afterEach(() => {
    window.location.hash = ''
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    vi.clearAllMocks()
  })

  it('stores the session from the URL fragment and navigates home', async () => {
    window.location.hash = '#access_token=access-1&refresh_token=refresh-1'
    getCurrentUser.mockResolvedValue({ id: 1, email: 'jane@example.com', role: 'candidate' })

    renderPage()

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
    expect(getCurrentUser).toHaveBeenCalledWith('access-1')
    expect(useAuthStore.getState().accessToken).toBe('access-1')
    expect(useAuthStore.getState().refreshToken).toBe('refresh-1')
    expect(useAuthStore.getState().user).toEqual({
      id: 1,
      email: 'jane@example.com',
      role: 'candidate',
    })
  })

  it('redirects to /login when the fragment has no tokens', async () => {
    window.location.hash = ''

    renderPage()

    expect(await screen.findByText('Login screen')).toBeInTheDocument()
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it('redirects to /login when fetching the user fails', async () => {
    window.location.hash = '#access_token=access-1&refresh_token=refresh-1'
    getCurrentUser.mockRejectedValue(new Error('network error'))

    renderPage()

    expect(await screen.findByText('Login screen')).toBeInTheDocument()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})
