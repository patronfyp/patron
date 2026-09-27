import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { login, register } from '../api/auth.api'

import RegisterPage from './RegisterPage'

vi.mock('../api/auth.api', () => ({
  register: vi.fn(),
  login: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

async function fillValidForm(user) {
  await user.type(screen.getByLabelText(/full name/i), 'Jane Doe')
  await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.type(screen.getByLabelText(/confirm password/i), 'password123')
  await user.click(screen.getByRole('combobox'))
  await user.click(await screen.findByText('Candidate'))
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the registration form', () => {
    renderPage()

    expect(screen.getByLabelText(/full name/i)).toBeVisible()
    expect(screen.getByLabelText(/email/i)).toBeVisible()
    expect(screen.getByLabelText('Password')).toBeVisible()
    expect(screen.getByLabelText(/confirm password/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /create account/i }))

    // antd's error text fades in via CSS transition - jsdom never finishes that
    // animation, so it stays "in the document" without ever reporting visible.
    expect(await screen.findByText('Full name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('calls the API with the right payload and logs in on success', async () => {
    const user = userEvent.setup()
    register.mockResolvedValue({ id: 1, email: 'jane@example.com' })
    login.mockResolvedValue({ access_token: 'token-123', refresh_token: 'refresh-123' })
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123',
        role: 'candidate',
      })
    })
    expect(login).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
    })
  })

  it('shows the server error on a duplicate email', async () => {
    const user = userEvent.setup()
    register.mockRejectedValue({
      response: { data: { detail: 'An account with this email already exists' } },
    })
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })
})
