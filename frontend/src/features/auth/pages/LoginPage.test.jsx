import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUser, login } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

import LoginPage from './LoginPage'

vi.mock('../api/auth.api', () => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
}))

function renderPage(initialEntries = ['/login']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/start" element={<div>Protected home</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, keepSignedIn: true })
    // Some CI/local environments' jsdom doesn't implement localStorage at all
    // (Node's own global can shadow it) - clearing is best-effort.
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // Nothing to clear if storage was never reachable.
    }
  })

  it('renders the login form', () => {
    renderPage()

    expect(screen.getByLabelText(/email/i)).toBeVisible()
    expect(screen.getByLabelText('Password')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  it('logs in successfully and redirects to the protected home page', async () => {
    const user = userEvent.setup()
    login.mockResolvedValue({ access_token: 'access-1', refresh_token: 'refresh-1' })
    getCurrentUser.mockResolvedValue({ id: 1, email: 'jane@example.com' })
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Protected home')).toBeVisible()
    expect(login).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'password123' })
  })

  it('shows the security note', () => {
    renderPage()

    expect(
      screen.getByText(
        'PATRON never posts to LinkedIn and never shares your profile without consent.',
      ),
    ).toBeInTheDocument()
  })

  it('keeps "Keep me signed in" checked by default, and passes it through on login', async () => {
    const user = userEvent.setup()
    login.mockResolvedValue({ access_token: 'access-1', refresh_token: 'refresh-1' })
    getCurrentUser.mockResolvedValue({ id: 1, email: 'jane@example.com' })
    renderPage()

    expect(screen.getByRole('checkbox', { name: /keep me signed in/i })).toBeChecked()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByText('Protected home')
    expect(login).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'password123' })
  })

  it('unchecking "Keep me signed in" carries false into the session', async () => {
    const user = userEvent.setup()
    login.mockResolvedValue({ access_token: 'access-1', refresh_token: 'refresh-1' })
    getCurrentUser.mockResolvedValue({ id: 1, email: 'jane@example.com' })
    renderPage()

    await user.click(screen.getByRole('checkbox', { name: /keep me signed in/i }))
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByText('Protected home')
    expect(useAuthStore.getState().keepSignedIn).toBe(false)
  })

  it('links to the forgot-password page', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('shows a success notice when it lands here after a password reset', async () => {
    renderPage([{ pathname: '/login', state: { passwordWasReset: true } }])

    expect(
      await screen.findByText('Your password has been reset. Please sign in.'),
    ).toBeInTheDocument()
  })

  it('shows the server error on a failed login', async () => {
    const user = userEvent.setup()
    login.mockRejectedValue({
      response: { data: { detail: 'Invalid email or password' } },
    })
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })
})
