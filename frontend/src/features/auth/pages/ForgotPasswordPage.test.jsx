import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestPasswordReset } from '../api/auth.api'

import ForgotPasswordPage from './ForgotPasswordPage'

vi.mock('../api/auth.api', () => ({
  requestPasswordReset: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/forgot-password']}>
          <Routes>
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/login" element={<div>Sign in page</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the same message whether or not the account exists', async () => {
    const user = userEvent.setup()
    requestPasswordReset.mockResolvedValue({})
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/if that account exists/i)).toBeInTheDocument()
    expect(requestPasswordReset.mock.calls[0][0]).toEqual({ email: 'jane@example.com' })
  })

  it('links back to sign in once sent', async () => {
    const user = userEvent.setup()
    requestPasswordReset.mockResolvedValue({})
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await user.click(await screen.findByRole('link', { name: /back to sign in/i }))
    expect(await screen.findByText('Sign in page')).toBeInTheDocument()
  })

  it('shows a real error without pretending the email was sent', async () => {
    const user = userEvent.setup()
    requestPasswordReset.mockRejectedValue({
      response: { data: { detail: 'Could not reach the mail server' } },
    })
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Could not reach the mail server')).toBeInTheDocument()
    expect(screen.queryByText(/if that account exists/i)).not.toBeInTheDocument()
  })
})
