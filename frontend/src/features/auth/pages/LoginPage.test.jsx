import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUser, login } from '../api/auth.api'

import LoginPage from './LoginPage'

vi.mock('../api/auth.api', () => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>Protected home</div>} />
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

  it('renders the login form', () => {
    renderPage()

    expect(screen.getByLabelText(/email/i)).toBeVisible()
    expect(screen.getByLabelText('Password')).toBeVisible()
    expect(screen.getByRole('button', { name: /log in/i })).toBeVisible()
  })

  it('logs in successfully and redirects to the protected home page', async () => {
    const user = userEvent.setup()
    login.mockResolvedValue({ access_token: 'access-1', refresh_token: 'refresh-1' })
    getCurrentUser.mockResolvedValue({ id: 1, email: 'jane@example.com' })
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Protected home')).toBeVisible()
    expect(login).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'password123' })
  })

  it('shows the server error on a failed login', async () => {
    const user = userEvent.setup()
    login.mockRejectedValue({
      response: { data: { detail: 'Invalid email or password' } },
    })
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })
})
